import { and, eq, sql } from "drizzle-orm";
import { Cause, Context, Data, Effect, Exit, Layer, Option, Ref } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { chapters, pages } from "../../../drizzle/schema/providers.js";
import {
	getFirst,
	SQLError,
	toSQLError,
} from "../../../drizzle/schema/utils.js";
import { ArchiveService } from "../archive/archive.service.js";
import { CloudflareService } from "../cloudflare/cloudflare.service.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import {
	MangaFetcherService,
	type MangaProvider,
} from "../mangaFetcher/mangaFetcher.service.js";
import type { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { ProviderProxyService } from "../providerProxy/providerProxy.service.js";
import { S3Service } from "../s3/s3.service.js";
import { ProviderRepository } from "./provider.repository.js";
import { ScanEventsService } from "./scanEvents.service.js";
import {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
	type MangaProviderStatus,
	ProviderArchive,
	ScanEvent,
} from "./scanProvider.domain.js";

export class MangaNotFoundById extends Data.TaggedError("MangaNotFoundById")<{
	readonly mangaId: MangaDbId;
}> {
	get internalMessage() {
		return `Manga with id=${this.mangaId} not found`;
	}
}

export class MangaProviderNotLinked extends Data.TaggedError(
	"MangaProviderNotLinked",
)<{
	readonly mangaId: MangaDbId;
	readonly provider: MangaProvider;
}> {
	get internalMessage() {
		return `Manga ${this.mangaId} has no link to provider ${this.provider}`;
	}
}

export class MangaProviderBusy extends Data.TaggedError("MangaProviderBusy")<{
	readonly mangaId: MangaDbId;
	readonly provider: MangaProvider;
	readonly status: MangaProviderStatus;
}> {
	get internalMessage() {
		return `Manga ${this.mangaId} provider ${this.provider} is busy (status=${this.status})`;
	}
}

export class ChapterNotFound extends Data.TaggedError("ChapterNotFound")<{
	readonly mangaId: MangaDbId;
	readonly provider: MangaProvider;
	readonly number: number;
}> {
	get internalMessage() {
		return `Chapter ${this.number} not found for manga ${this.mangaId} on provider ${this.provider}`;
	}
}

export class PageNotFound extends Data.TaggedError("PageNotFound")<{
	readonly mangaId: MangaDbId;
	readonly provider: MangaProvider;
	readonly number: number;
	readonly pageNumber: number;
}> {
	get internalMessage() {
		return `Page ${this.pageNumber} not found for chapter ${this.number} of manga ${this.mangaId} on provider ${this.provider}`;
	}
}

const archiveKey = (mangaDbId: MangaDbId, provider: MangaProvider) =>
	`${mangaDbId}/archives/${provider}.zip`;

const extensionOf = (pathOrUrl: string) => pathOrUrl.split(".").pop() || "jpg";

const byNumber = (a: { number: number }, b: { number: number }) =>
	a.number - b.number;

function toChapterSummary(row: {
	readonly number: number;
	readonly pages: readonly unknown[];
	readonly createdAt: Date;
}) {
	return new ChapterSummary({
		number: row.number,
		pageCount: row.pages.length,
		createdAt: row.createdAt,
	});
}

const make = Effect.gen(function* () {
	const db = yield* DB;
	const s3 = yield* S3Service;
	const archive = yield* ArchiveService;
	const mangaFetcher = yield* MangaFetcherService;
	const providerRepo = yield* ProviderRepository;
	const scanEvents = yield* ScanEventsService;
	const cloudflare = yield* CloudflareService;
	const providerProxy = yield* ProviderProxyService;

	const publish = (
		mangaDbId: MangaDbId,
		provider: MangaProvider,
		status: MangaProviderStatus | null,
	) => scanEvents.publish(mangaDbId, new ScanEvent({ provider, status }));

	const upsertChapterRow = (
		mangaDbId: MangaDbId,
		providerId: string,
		number: number,
	) =>
		db
			.insert(chapters)
			.values({ mangaId: mangaDbId, providerId, number })
			.onConflictDoUpdate({
				target: [chapters.mangaId, chapters.providerId, chapters.number],
				set: { number: sql`excluded.number` },
			})
			.returning()
			.pipe(
				Effect.mapError(toSQLError),
				getFirst(new SQLError({ message: "failed to upsert chapter" })),
			);

	/**
	 * Uploads a chapter's pages and records them; uploaded files are removed if
	 * anything fails. `fetchPage` downloads `url` and stores it under `key`.
	 */
	const processChapter = Effect.fn("ScanProviderService.processChapter")(
		function* <E>(
			mangaDbId: MangaDbId,
			providerId: string,
			chapter: { chapterNumber: number; pages: readonly string[] },
			fetchPage: (key: string, url: string) => Effect.Effect<unknown, E>,
		) {
			const uploadedKeys = yield* Ref.make<string[]>([]);

			const uploadPage = (pageUrl: string, index: number) => {
				const key = `${mangaDbId}/${chapter.chapterNumber}/${index + 1}.${extensionOf(new URL(pageUrl).pathname)}`;
				return fetchPage(key, pageUrl).pipe(
					Effect.tap(() => Ref.update(uploadedKeys, (keys) => [...keys, key])),
					Effect.as({ number: index + 1, path: key }),
				);
			};

			const store = Effect.gen(function* () {
				const pagePaths = yield* Effect.forEach(chapter.pages, uploadPage, {
					concurrency: 5,
				});
				const chapterRow = yield* upsertChapterRow(
					mangaDbId,
					providerId,
					chapter.chapterNumber,
				);
				if (pagePaths.length === 0) {
					return;
				}
				yield* db
					.insert(pages)
					.values(
						pagePaths.map((page) => ({ chapterId: chapterRow.id, ...page })),
					)
					.onConflictDoUpdate({
						target: [pages.chapterId, pages.number],
						set: { path: sql`excluded.path` },
					})
					.pipe(Effect.mapError(toSQLError));
			});

			yield* store.pipe(
				Effect.onError(() =>
					Ref.get(uploadedKeys).pipe(
						Effect.flatMap(s3.manga.deleteObjects),
						Effect.ignore({ log: true }),
					),
				),
			);
		},
	);

	// Only reached when a take failed, so the link is held by someone else;
	// the re-read is for the error payload, not for the decision.
	const mangaProviderBusy = Effect.fn("ScanProviderService.mangaProviderBusy")(
		function* (mangaDbId: MangaDbId, provider: MangaProvider) {
			const link = yield* providerRepo.findMangaProviderLink(
				mangaDbId,
				provider,
			);
			return yield* new MangaProviderBusy({
				mangaId: mangaDbId,
				provider,
				status: Option.match(link, {
					onNone: () => "UPDATING" as const,
					onSome: (held) => held.status,
				}),
			});
		},
	);

	const resolveProviderId = Effect.fn("ScanProviderService.resolveProviderId")(
		function* (mangaDbId: MangaDbId, provider: MangaProvider) {
			const providerId = yield* providerRepo.findProviderIdByName(provider);
			if (Option.isNone(providerId)) {
				return yield* new MangaProviderNotLinked({
					mangaId: mangaDbId,
					provider,
				});
			}
			return providerId.value;
		},
	);

	const findChapters = (mangaDbId: MangaDbId, providerId: string) =>
		db.query.chapters
			.findMany({
				where: { mangaId: mangaDbId, providerId },
				with: { pages: true },
				orderBy: { number: "asc" },
			})
			.pipe(Effect.mapError(toSQLError));

	const findChapter = (
		mangaDbId: MangaDbId,
		provider: MangaProvider,
		providerId: string,
		number: number,
	) =>
		db.query.chapters
			.findFirst({
				where: { mangaId: mangaDbId, providerId, number },
				with: { pages: true },
			})
			.pipe(
				Effect.mapError(toSQLError),
				Effect.flatMap((row) =>
					row
						? Effect.succeed(row)
						: Effect.fail(
								new ChapterNotFound({ mangaId: mangaDbId, provider, number }),
							),
				),
			);

	const buildProviderArchive = Effect.fn(
		"ScanProviderService.buildProviderArchive",
	)(function* (mangaDbId: MangaDbId, provider: MangaProvider) {
		const providerId = yield* resolveProviderId(mangaDbId, provider);
		const rows = yield* findChapters(mangaDbId, providerId);
		const key = archiveKey(mangaDbId, provider);
		const zip = archive.createZipStream();
		const abortZip = (cause: Cause.Cause<unknown>) =>
			Effect.sync(() => zip.abort(new Error(Cause.pretty(cause))));

		const feed = Effect.gen(function* () {
			for (const chapter of rows) {
				const folder = `Chapter ${String(chapter.number).padStart(3, "0")}`;
				const downloaded = yield* Effect.forEach(
					chapter.pages.slice().sort(byNumber),
					(page) =>
						s3.manga
							.download(page.path)
							.pipe(Effect.map((data) => ({ page, data }))),
					{ concurrency: 5 },
				);
				for (const { page, data } of downloaded) {
					const fileName = `${String(page.number).padStart(3, "0")}.${extensionOf(page.path)}`;
					yield* zip.addEntry(`${folder}/${fileName}`, data);
				}
			}
			yield* zip.end();
		}).pipe(Effect.onError(abortZip));

		const push = s3.manga
			.uploadStream(key, zip.readable, "application/zip")
			.pipe(Effect.onError(abortZip));

		yield* Effect.all([feed, push], { concurrency: 2 });

		const url = yield* s3.manga.getUrl(key);
		return new ProviderArchive({ url });
	});

	/** The background part of a sync: fetch every chapter, then rebuild the archive. */
	const runSync = Effect.fn("ScanProviderService.runSync")(function* (
		mangaDbId: MangaDbId,
		providerId: string,
		slug: string,
		provider: MangaProvider,
	) {
		const cf = yield* cloudflare.session(provider);
		const rawChapters = yield* cf.run(
			(clearance) => mangaFetcher.getMangaChapters(slug, provider, clearance),
			(error) => error.needsClearance,
		);
		const fetchPage = (key: string, url: string) =>
			cf.run(
				(clearance) =>
					s3.manga.fetchAndUpload(key, url, {
						headers: mangaFetcher.getPageRequestHeaders(
							provider,
							url,
							clearance,
						),
						client: providerProxy.httpClient(provider),
					}),
				(error) =>
					error._tag === "ImageFetchFailed" &&
					error.cloudflareChallenge === true,
			);
		yield* Effect.forEach(
			rawChapters,
			(chapter) =>
				processChapter(
					mangaDbId,
					providerId,
					{ chapterNumber: chapter.number + 1, pages: chapter.pages },
					fetchPage,
				).pipe(
					Effect.andThen(
						providerRepo.touchMangaProviderLink(mangaDbId, providerId),
					),
				),
			{ concurrency: 3 },
		);
		yield* buildProviderArchive(mangaDbId, provider);
	});

	const syncMangaChapters = Effect.fn("ScanProviderService.syncMangaChapters")(
		function* (
			mangaDbId: MangaDbId,
			slug: string,
			provider: MangaProvider,
			isNewLink: boolean,
		) {
			const manga = yield* db.query.mangas
				.findFirst({ where: { id: mangaDbId } })
				.pipe(Effect.mapError(toSQLError));
			if (!manga) {
				return yield* new MangaNotFoundById({ mangaId: mangaDbId });
			}

			const startStatus = isNewLink ? "CREATING" : "UPDATING";
			const acquired = yield* providerRepo.acquireMangaProviderLink(
				mangaDbId,
				provider,
				slug,
				startStatus,
			);
			if (Option.isNone(acquired)) {
				return yield* mangaProviderBusy(mangaDbId, provider);
			}
			const providerId = acquired.value;
			yield* publish(mangaDbId, provider, startStatus);

			const resolveStatus = (exit: Exit.Exit<unknown, unknown>) => {
				const finalStatus = Exit.isSuccess(exit) ? "UPDATED" : "FAILED";
				return providerRepo.setStatus(mangaDbId, providerId, finalStatus).pipe(
					Effect.andThen(publish(mangaDbId, provider, finalStatus)),
					Effect.catchCause((cause) =>
						Effect.logError(
							`failed to resolve manga_providers status to ${finalStatus} for manga=${mangaDbId} provider=${provider}`,
							cause,
						),
					),
				);
			};

			yield* runSync(mangaDbId, providerId, slug, provider).pipe(
				Effect.onExit(resolveStatus),
				Effect.catchCause((cause) =>
					Effect.logError(
						`chapter sync failed for manga=${mangaDbId} provider=${provider}`,
						cause,
					),
				),
				Effect.forkDetach,
			);
		},
	);

	const listChapterNumbers = Effect.fn(
		"ScanProviderService.listChapterNumbers",
	)(function* (mangaDbId: MangaDbId, provider: MangaProvider) {
		const providerId = yield* resolveProviderId(mangaDbId, provider);
		const rows = yield* findChapters(mangaDbId, providerId);
		return rows.map(toChapterSummary);
	});

	const listMangaProviders = Effect.fn(
		"ScanProviderService.listMangaProviders",
	)(function* (mangaDbId: MangaDbId) {
		const links = yield* db.query.mangaProviders
			.findMany({
				where: { mangaId: mangaDbId },
				with: {
					provider: true,
					catalogEntry: { columns: { chapterCount: true } },
					chapters: { with: { pages: true }, orderBy: { number: "asc" } },
				},
			})
			.pipe(Effect.mapError(toSQLError));

		return links.map(
			(link) =>
				new MangaProviderChapters({
					provider: link.provider.name,
					chapters: link.chapters.map(toChapterSummary),
					tag: link.tag,
					status: link.status,
					chapterCount: link.catalogEntry?.chapterCount ?? 0,
				}),
		);
	});

	/** Removes a provider's pages, archive and chapter rows, then the link itself. */
	const deleteMangaProviderChapters = Effect.fn(
		"ScanProviderService.deleteMangaProviderChapters",
	)(function* (mangaDbId: MangaDbId, provider: MangaProvider) {
		const link = yield* providerRepo.findMangaProviderLink(mangaDbId, provider);
		if (Option.isNone(link)) {
			return yield* new MangaProviderNotLinked({
				mangaId: mangaDbId,
				provider,
			});
		}
		const { providerId } = link.value;

		const acquired = yield* providerRepo.acquireMangaProviderDeletion(
			mangaDbId,
			providerId,
		);
		if (!acquired) {
			return yield* mangaProviderBusy(mangaDbId, provider);
		}
		yield* publish(mangaDbId, provider, "DELETING");

		const deleteContent = Effect.gen(function* () {
			const rows = yield* findChapters(mangaDbId, providerId);
			const paths = rows.flatMap((row) => row.pages.map((page) => page.path));
			yield* s3.manga.deleteObjects([
				...paths,
				archiveKey(mangaDbId, provider),
			]);
			yield* db
				.delete(chapters)
				.where(
					and(
						eq(chapters.mangaId, mangaDbId),
						eq(chapters.providerId, providerId),
					),
				)
				.pipe(Effect.mapError(toSQLError));
		});

		const resolveLink = (exit: Exit.Exit<unknown, unknown>) =>
			(Exit.isSuccess(exit)
				? providerRepo
						.deleteMangaProviderLink(mangaDbId, providerId)
						.pipe(Effect.andThen(publish(mangaDbId, provider, null)))
				: providerRepo
						.setStatus(mangaDbId, providerId, "FAILED")
						.pipe(Effect.andThen(publish(mangaDbId, provider, "FAILED")))
			).pipe(
				Effect.catchCause((cause) =>
					Effect.logError(
						`failed to resolve manga_providers status after delete for manga=${mangaDbId} provider=${provider}`,
						cause,
					),
				),
			);

		yield* Effect.onExit(deleteContent, resolveLink);
	});

	const getChapterPages = Effect.fn("ScanProviderService.getChapterPages")(
		function* (
			mangaDbId: MangaDbId,
			mangaId: AniListId,
			provider: MangaProvider,
			chapterNumber: number,
		) {
			const providerId = yield* resolveProviderId(mangaDbId, provider);
			const [chapter, nextChapter] = yield* Effect.all([
				findChapter(mangaDbId, provider, providerId, chapterNumber),
				db.query.chapters
					.findFirst({
						where: {
							mangaId: mangaDbId,
							providerId,
							number: chapterNumber + 1,
						},
					})
					.pipe(Effect.mapError(toSQLError)),
			]);

			const pagesUrl = `/api/scan/${mangaId}/providers/${provider}/chapters/${chapterNumber}/pages`;
			return new ChapterPages({
				pages: chapter.pages
					.slice()
					.sort(byNumber)
					.map((page) => `${pagesUrl}/${page.number}`),
				hasNextChapter: nextChapter !== undefined,
			});
		},
	);

	const getChapterPagePresignedUrl = Effect.fn(
		"ScanProviderService.getChapterPagePresignedUrl",
	)(function* (
		mangaDbId: MangaDbId,
		provider: MangaProvider,
		chapterNumber: number,
		pageNumber: number,
	) {
		const providerId = yield* resolveProviderId(mangaDbId, provider);
		const chapter = yield* findChapter(
			mangaDbId,
			provider,
			providerId,
			chapterNumber,
		);
		const page = chapter.pages.find((page) => page.number === pageNumber);
		if (!page) {
			return yield* new PageNotFound({
				mangaId: mangaDbId,
				provider,
				number: chapterNumber,
				pageNumber,
			});
		}
		return yield* s3.manga.getUrl(page.path);
	});

	return {
		syncMangaChapters,
		listChapterNumbers,
		listMangaProviders,
		getChapterPages,
		getChapterPagePresignedUrl,
		deleteMangaProviderChapters,
		buildProviderArchive,
		getProviderArchive: archiveKey,
		hasMangaProviderLink: providerRepo.hasMangaProviderLink,
	};
});

export class ScanProviderService extends Context.Service<ScanProviderService>()(
	"api/ScanProviderService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([
			DBLayer,
			S3Service.Default,
			ArchiveService.Default,
			MangaFetcherService.Default,
			ProviderRepository.Default,
			ScanEventsService.Default,
			CloudflareService.Default,
			ProviderProxyService.Default,
		]),
	);
}
