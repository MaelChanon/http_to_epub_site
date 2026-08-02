import { sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { DB, DBLayer } from "../db.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import {
	MangaNativeService,
	type MangaProvider,
} from "../manga/mangaNative.service.js";
import { S3Service } from "../s3/s3.service.js";
import {
	chapters,
	mangaProviders,
	pages,
	providers,
} from "../schema/providers.js";
import { SQLError, toSQLError } from "../schema/utils.js";

export class MangaNotFoundById extends Data.TaggedError("MangaNotFoundById")<{
	readonly mangaId: MangaDbId;
}> {
	get internalMessage() {
		return `Manga with id=${this.mangaId} not found`;
	}
}

export class ScanProviderService extends Effect.Service<ScanProviderService>()(
	"api/ScanProviderService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;
			const s3 = yield* S3Service;
			const mangaNative = yield* MangaNativeService;

			function ensureMangaProviderLink(
				mangaDbId: MangaDbId,
				providerName: MangaProvider,
			) {
				return db
					.transaction((tx) =>
						Effect.gen(function* () {
							const existing = yield* tx.query.providers
								.findFirst({ where: { name: providerName } })
								.pipe(Effect.mapError(toSQLError));

							let providerId: string;
							if (existing) {
								providerId = existing.id;
							} else {
								const inserted = yield* tx
									.insert(providers)
									.values({ name: providerName })
									.onConflictDoNothing({ target: providers.name })
									.returning()
									.pipe(Effect.mapError(toSQLError));

								if (inserted[0]) {
									providerId = inserted[0].id;
								} else {
									const row = yield* tx.query.providers
										.findFirst({ where: { name: providerName } })
										.pipe(Effect.mapError(toSQLError));

									if (!row) {
										return yield* Effect.fail(
											new SQLError({
												message: `provider "${providerName}" missing after conflict`,
											}),
										);
									}
									providerId = row.id;
								}
							}

							yield* tx
								.insert(mangaProviders)
								.values({ mangaId: mangaDbId, providerId })
								.onConflictDoNothing({
									target: [mangaProviders.mangaId, mangaProviders.providerId],
								})
								.pipe(Effect.mapError(toSQLError));

							return providerId;
						}),
					)
					.pipe(Effect.catchTag("SqlError", toSQLError));
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

					const chapterRows = yield* db
						.insert(chapters)
						.values({
							mangaId: mangaDbId,
							providerId,
							number: chapter.chapterNumber,
						})
						.onConflictDoUpdate({
							target: [chapters.mangaId, chapters.providerId, chapters.number],
							set: { number: sql`excluded.number` },
						})
						.returning()
						.pipe(Effect.mapError(toSQLError));

					const chapterRow = chapterRows[0];
					if (!chapterRow) {
						return yield* Effect.fail(
							new SQLError({ message: "failed to upsert chapter" }),
						);
					}

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

					const providerId = yield* ensureMangaProviderLink(
						mangaDbId,
						provider,
					);

					const rawChapters = yield* mangaNative.getMangaChapters(
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

			return {
				syncMangaChapters,
			} as const;
		}),
		dependencies: [DBLayer, S3Service.Default, MangaNativeService.Default],
	},
) {}
