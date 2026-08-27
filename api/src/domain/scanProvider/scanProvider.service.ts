import { and, eq, sql } from "drizzle-orm";
import { Cause, Data, Effect, Exit, Option, Ref } from "effect";
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
import { ScanEventsService } from "./scanEvents.service.js";
import {
	ChapterPages,
	ChapterSummary,
	isMangaProviderTransitioning,
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
			const scanEvents = yield* ScanEventsService;

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
			function getProviderArchive(mangaDbId: MangaDbId, provider: string) {
				return Effect.succeed(`${mangaDbId}/archives/${provider}.zip`);
			}

			function processChapter(
				mangaDbId: MangaDbId,
				providerId: string,
				chapter: { chapterNumber: number; pages: readonly string[] },
			) {
				return Ref.make<string[]>([]).pipe(
					Effect.flatMap((uploadedKeys) =>
						Effect.gen(function* () {
							const pagePaths = yield* Effect.forEach(
								chapter.pages,
								(pageUrl, index) => {
									const key = `${mangaDbId}/${chapter.chapterNumber}/${index + 1}.${new URL(pageUrl).pathname.split(".").pop() || "jpg"}`;
									return s3.manga.fetchAndUpload(key, pageUrl).pipe(
										Effect.tap(() =>
											Ref.update(uploadedKeys, (keys) => [...keys, key]),
										),
										Effect.as({ number: index + 1, path: key }),
									);
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
						}).pipe(
							Effect.onError(() =>
								Ref.get(uploadedKeys).pipe(
									Effect.flatMap((keys) => s3.manga.deleteObjects(keys)),
									Effect.ignoreLogged,
								),
							),
						),
					),
				);
			}

			function syncMangaChapters(
				mangaDbId: MangaDbId,
				slug: string,
				provider: MangaProvider,
				isNewLink: boolean,
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

					const existingLink = yield* providerRepo.findMangaProviderLink(
						mangaDbId,
						provider,
					);
					if (
						Option.isSome(existingLink) &&
						isMangaProviderTransitioning(existingLink.value.status)
					) {
						return yield* Effect.fail(
							new MangaProviderBusy({
								mangaId: mangaDbId,
								provider,
								status: existingLink.value.status,
							}),
						);
					}

					const startStatus: MangaProviderStatus = isNewLink
						? "CREATING"
						: "UPDATING";

					const providerId = yield* providerRepo.ensureMangaProviderLink(
						mangaDbId,
						provider,
						slug,
						startStatus,
					);
					yield* scanEvents.publish(
						mangaDbId,
						new ScanEvent({ provider, status: startStatus }),
					);

					yield* Effect.forkDaemon(
						Effect.gen(function* () {
							const rawChapters = yield* mangaFetcher.getMangaChapters(
								slug,
								provider,
							);
							yield* Effect.forEach(
								rawChapters,
								(chapter) =>
									processChapter(mangaDbId, providerId, {
										...chapter,
										chapterNumber: chapter.chapterNumber + 1,
									}),
								{ concurrency: 3 },
							);

							yield* buildProviderArchive(mangaDbId, provider).pipe(
								Effect.asVoid,
							);
						}).pipe(
							Effect.onExit((exit) => {
								const finalStatus: MangaProviderStatus = Exit.isSuccess(exit)
									? "UPDATED"
									: "FAILED";
								return Effect.andThen(
									providerRepo.setStatus(mangaDbId, providerId, finalStatus),
									scanEvents.publish(
										mangaDbId,
										new ScanEvent({ provider, status: finalStatus }),
									),
								).pipe(
									Effect.catchAllCause((cause) =>
										Effect.logError(
											`failed to resolve manga_providers status to ${finalStatus} for manga=${mangaDbId} provider=${provider}: ${cause}`,
										),
									),
								);
							}),
							Effect.catchAllCause((cause) =>
								Effect.logError(
									`chapter sync failed for manga=${mangaDbId} provider=${provider}: ${cause}`,
								),
							),
						),
					);
				}).pipe(Effect.asVoid);
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
					const links = yield* db.query.mangaProviders
						.findMany({
							where: { mangaId: mangaDbId },
							with: {
								provider: true,
								catalogEntry: { columns: { chapterCount: true } },
								chapters: {
									with: { pages: true },
									orderBy: { number: "asc" },
								},
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
			}

			function deleteMangaProviderChapters(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return Effect.gen(function* () {
					const link = yield* providerRepo.findMangaProviderLink(
						mangaDbId,
						provider,
					);
					const { providerId, status } = yield* Option.match(link, {
						onNone: () =>
							Effect.fail(
								new MangaProviderNotLinked({ mangaId: mangaDbId, provider }),
							),
						onSome: Effect.succeed,
					});
					if (isMangaProviderTransitioning(status)) {
						return yield* Effect.fail(
							new MangaProviderBusy({ mangaId: mangaDbId, provider, status }),
						);
					}

					yield* Effect.andThen(
						providerRepo.setStatus(mangaDbId, providerId, "DELETING"),
						scanEvents.publish(
							mangaDbId,
							new ScanEvent({ provider, status: "DELETING" }),
						),
					);

					yield* Effect.gen(function* () {
						const rows = yield* db.query.chapters
							.findMany({
								where: { mangaId: mangaDbId, providerId },
								with: { pages: true },
							})
							.pipe(Effect.mapError(toSQLError));

						const paths = rows.flatMap((row) =>
							row.pages.map((page) => page.path),
						);
						const archiveKey = `${mangaDbId}/archives/${provider}.zip`;

						yield* s3.manga.deleteObjects([...paths, archiveKey]);

						yield* db
							.delete(chapters)
							.where(
								and(
									eq(chapters.mangaId, mangaDbId),
									eq(chapters.providerId, providerId),
								),
							)
							.pipe(Effect.mapError(toSQLError));
					}).pipe(
						Effect.onExit((exit) =>
							(Exit.isSuccess(exit)
								? Effect.andThen(
										providerRepo.deleteMangaProviderLink(mangaDbId, providerId),
										scanEvents.publish(
											mangaDbId,
											new ScanEvent({ provider, status: null }),
										),
									)
								: Effect.andThen(
										providerRepo.setStatus(mangaDbId, providerId, "FAILED"),
										scanEvents.publish(
											mangaDbId,
											new ScanEvent({ provider, status: "FAILED" }),
										),
									)
							).pipe(
								Effect.catchAllCause((cause) =>
									Effect.logError(
										`failed to resolve manga_providers status after delete for manga=${mangaDbId} provider=${provider}: ${cause}`,
									),
								),
							),
						),
					);
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

					return yield* s3.manga.getUrl(pageRow.path);
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

					const key = yield* getProviderArchive(mangaDbId, provider);
					const zip = archive.createZipStream();

					const feed = Effect.gen(function* () {
						for (const chapter of rows) {
							const folder = `Chapter ${String(chapter.number).padStart(3, "0")}`;

							const downloaded = yield* Effect.forEach(
								chapter.pages.slice().sort((a, b) => a.number - b.number),
								(page) =>
									s3.manga
										.download(page.path)
										.pipe(Effect.map((data) => ({ page, data }))),
								{ concurrency: 5 },
							);

							for (const { page, data } of downloaded) {
								const ext = page.path.split(".").pop() || "jpg";
								const fileName = `${String(page.number).padStart(3, "0")}.${ext}`;
								yield* zip.addEntry(`${folder}/${fileName}`, data);
							}
						}

						yield* zip.end();
					}).pipe(
						Effect.onError((cause) =>
							Effect.sync(() => zip.abort(new Error(Cause.pretty(cause)))),
						),
					);

					const push = s3.manga
						.uploadStream(key, zip.readable, "application/zip")
						.pipe(
							Effect.onError((cause) =>
								Effect.sync(() => zip.abort(new Error(Cause.pretty(cause)))),
							),
						);

					yield* Effect.all([feed, push], { concurrency: 2 });

					const url = yield* s3.manga.getUrl(key);

					return new ProviderArchive({ url });
				});
			}

			function hasMangaProviderLink(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
			) {
				return providerRepo.hasMangaProviderLink(mangaDbId, provider);
			}

			return {
				syncMangaChapters,
				listChapterNumbers,
				listMangaProviders,
				getChapterPages,
				getChapterPagePresignedUrl,
				deleteMangaProviderChapters,
				buildProviderArchive,
				getProviderArchive,
				hasMangaProviderLink,
			} as const;
		}),
		dependencies: [
			DBLayer,
			S3Service.Default,
			ArchiveService.Default,
			MangaFetcherService.Default,
			ProviderRepository.Default,
			ScanEventsService.Default,
		],
	},
) {}
