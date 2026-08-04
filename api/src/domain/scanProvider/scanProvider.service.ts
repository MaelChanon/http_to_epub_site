import { and, eq, sql } from "drizzle-orm";
import { Data, Effect, Option } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { chapters, pages } from "../../../drizzle/schema/providers.js";
import { SQLError, toSQLError } from "../../../drizzle/schema/utils.js";
import { ArchiveService } from "../archive/archive.service.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import {
	MangaFetcherService,
	type MangaProvider,
} from "../mangaFetcher/mangaFetcher.service.js";
import type { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { S3Service } from "../s3/s3.service.js";
import { ProviderRepository } from "./provider.repository.js";
import {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
	ProviderArchive,
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
	readonly pageIndex: number;
}> {
	get internalMessage() {
		return `Page ${this.pageIndex} not found for chapter ${this.number} of manga ${this.mangaId} on provider ${this.provider}`;
	}
}

export class ScanProviderService extends Effect.Service<ScanProviderService>()(
	"api/ScanProviderService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;
			const s3 = yield* S3Service;
			const archive = yield* ArchiveService;
			const mangaFetcher = yield* MangaFetcherService;
			const providerRepo = yield* ProviderRepository;

			function upsertChapterRow(
				mangaDbId: MangaDbId,
				providerId: string,
				number: number,
			) {
				return db
					.insert(chapters)
					.values({ mangaId: mangaDbId, providerId, number })
					.onConflictDoUpdate({
						target: [chapters.mangaId, chapters.providerId, chapters.number],
						set: { number: sql`excluded.number` },
					})
					.returning()
					.pipe(
						Effect.mapError(toSQLError),
						Effect.flatMap((rows) =>
							rows[0]
								? Effect.succeed(rows[0])
								: Effect.fail(
										new SQLError({ message: "failed to upsert chapter" }),
									),
						),
					);
			}

			function processChapter(
				mangaDbId: MangaDbId,
				providerId: string,
				chapter: { chapterNumber: number; pages: readonly string[] },
			) {
				return Effect.gen(function* () {
					const pagePaths = yield* Effect.forEach(
						chapter.pages,
						(pageUrl, index) => {
							const key = `${mangaDbId}/${chapter.chapterNumber}/${index + 1}.${new URL(pageUrl).pathname.split(".").pop() || "jpg"}`;
							return s3
								.fetchAndUpload(key, pageUrl)
								.pipe(Effect.as({ number: index + 1, path: key }));
						},
						{ concurrency: 5 },
					);

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
							pagePaths.map((p) => ({
								chapterId: chapterRow.id,
								number: p.number,
								path: p.path,
							})),
						)
						.onConflictDoUpdate({
							target: [pages.chapterId, pages.number],
							set: { path: sql`excluded.path` },
						})
						.pipe(Effect.mapError(toSQLError));
				});
			}

			function syncMangaChapters(
				mangaDbId: MangaDbId,
				slug: string,
				provider: MangaProvider,
			) {
				return Effect.gen(function* () {
					const manga = yield* db.query.mangas
						.findFirst({ where: { id: mangaDbId } })
						.pipe(Effect.mapError(toSQLError));

					if (!manga) {
						return yield* Effect.fail(
							new MangaNotFoundById({ mangaId: mangaDbId }),
						);
					}

					const providerId = yield* providerRepo.ensureMangaProviderLink(
						mangaDbId,
						provider,
						slug,
					);

					const rawChapters = yield* mangaFetcher.getMangaChapters(
						slug,
						provider,
					);

					yield* Effect.forEach(
						rawChapters,
						(chapter) => processChapter(mangaDbId, providerId, chapter),
						{ concurrency: 3 },
					);
				});
			}

			function resolveProviderId(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return providerRepo.findProviderIdByName(provider).pipe(
					Effect.flatMap(
						Option.match({
							onNone: () =>
								Effect.fail(
									new MangaProviderNotLinked({ mangaId: mangaDbId, provider }),
								),
							onSome: Effect.succeed,
						}),
					),
				);
			}

			type ChapterRow = NonNullable<
				Effect.Effect.Success<
					ReturnType<
						typeof db.query.chapters.findFirst<{
							with: { pages: true };
						}>
					>
				>
			>;
			function toChapterSummary(row: ChapterRow) {
				return new ChapterSummary({
					number: row.number,
					pageCount: row.pages.length,
					createdAt: row.createdAt,
				});
			}

			function listChapterNumbers(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const rows = yield* db.query.chapters
						.findMany({
							where: { mangaId: mangaDbId, providerId },
							with: { pages: true },
							orderBy: { number: "asc" },
						})
						.pipe(Effect.mapError(toSQLError));

					return rows.map(toChapterSummary);
				});
			}

			function listMangaProviders(mangaDbId: MangaDbId) {
				return Effect.gen(function* () {
					const [rows, links] = yield* Effect.all([
						db.query.chapters
							.findMany({
								where: { mangaId: mangaDbId },
								with: { pages: true, provider: true },
								orderBy: { number: "asc" },
							})
							.pipe(Effect.mapError(toSQLError)),
						db.query.mangaProviders
							.findMany({
								where: { mangaId: mangaDbId },
								with: { provider: true },
							})
							.pipe(Effect.mapError(toSQLError)),
					]);

					const tagByProvider = new Map<MangaProvider, string>();
					for (const link of links) {
						tagByProvider.set(link.provider.name, link.tag);
					}

					const chaptersByProvider = new Map<MangaProvider, ChapterSummary[]>();
					for (const row of rows) {
						const provider = row.provider.name;
						const summaries = chaptersByProvider.get(provider) ?? [];
						summaries.push(toChapterSummary(row));
						chaptersByProvider.set(provider, summaries);
					}

					return Array.from(
						chaptersByProvider,
						([provider, chapters]) =>
							new MangaProviderChapters({
								provider,
								chapters,
								tag: tagByProvider.get(provider) ?? "none",
							}),
					);
				});
			}

			function deleteMangaProviderChapters(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const rows = yield* db.query.chapters
						.findMany({
							where: { mangaId: mangaDbId, providerId },
							with: { pages: true },
						})
						.pipe(Effect.mapError(toSQLError));

					const paths = rows.flatMap((row) =>
						row.pages.map((page) => page.path),
					);

					yield* s3.deleteObjects(paths);

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
			}

			function getSortedPages(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
				chapterNumber: number,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const chapterRow = yield* db.query.chapters
						.findFirst({
							where: {
								mangaId: mangaDbId,
								providerId,
								number: chapterNumber,
							},
							with: { pages: true },
						})
						.pipe(Effect.mapError(toSQLError));

					if (!chapterRow) {
						return yield* Effect.fail(
							new ChapterNotFound({
								mangaId: mangaDbId,
								provider,
								number: chapterNumber,
							}),
						);
					}

					return chapterRow.pages.slice().sort((a, b) => a.number - b.number);
				});
			}

			function getChapterPages(
				mangaDbId: MangaDbId,
				mangaId: AniListId,
				provider: MangaProvider,
				chapterNumber: number,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const [sortedPages, nextChapterRow] = yield* Effect.all([
						getSortedPages(mangaDbId, provider, chapterNumber),
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

					return new ChapterPages({
						pages: sortedPages.map(
							(_, index) =>
								`/api/scan/${mangaId}/providers/${provider}/chapters/${chapterNumber}/pages/${index}`,
						),
						hasNextChapter: nextChapterRow !== undefined,
					});
				});
			}

			function getChapterPagePresignedUrl(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
				chapterNumber: number,
				pageIndex: number,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const chapterRow = yield* db.query.chapters
						.findFirst({
							where: {
								mangaId: mangaDbId,
								providerId,
								number: chapterNumber,
							},
						})
						.pipe(Effect.mapError(toSQLError));

					if (!chapterRow) {
						return yield* Effect.fail(
							new ChapterNotFound({
								mangaId: mangaDbId,
								provider,
								number: chapterNumber,
							}),
						);
					}

					const pageRow = yield* db.query.pages
						.findFirst({
							where: { chapterId: chapterRow.id, number: pageIndex + 1 },
						})
						.pipe(Effect.mapError(toSQLError));

					if (!pageRow) {
						return yield* Effect.fail(
							new PageNotFound({
								mangaId: mangaDbId,
								provider,
								number: chapterNumber,
								pageIndex,
							}),
						);
					}

					return yield* s3.getUrl(pageRow.path);
				});
			}

			function buildProviderArchive(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const rows = yield* db.query.chapters
						.findMany({
							where: { mangaId: mangaDbId, providerId },
							with: { pages: true },
							orderBy: { number: "asc" },
						})
						.pipe(Effect.mapError(toSQLError));

					const pageEntries = rows.flatMap((chapter) =>
						chapter.pages
							.slice()
							.sort((a, b) => a.number - b.number)
							.map((page) => {
								const ext = page.path.split(".").pop() || "jpg";
								const folder = `Chapter ${String(chapter.number).padStart(3, "0")}`;
								const fileName = `${String(page.number).padStart(3, "0")}.${ext}`;
								return { path: page.path, entryName: `${folder}/${fileName}` };
							}),
					);

					const entries = yield* Effect.forEach(
						pageEntries,
						({ path, entryName }) =>
							s3
								.download(path)
								.pipe(Effect.map((data) => ({ entryName, data }))),
						{ concurrency: 5 },
					);

					const zip = yield* archive.buildZip(entries);

					const key = `${mangaDbId}/archives/${provider}.zip`;
					yield* s3.upload(key, zip, "application/zip");
					const url = yield* s3.getUrl(key);

					return new ProviderArchive({ url });
				});
			}

			return {
				syncMangaChapters,
				listChapterNumbers,
				listMangaProviders,
				getChapterPages,
				getChapterPagePresignedUrl,
				deleteMangaProviderChapters,
				buildProviderArchive,
			} as const;
		}),
		dependencies: [
			DBLayer,
			S3Service.Default,
			ArchiveService.Default,
			MangaFetcherService.Default,
			ProviderRepository.Default,
		],
	},
) {}
