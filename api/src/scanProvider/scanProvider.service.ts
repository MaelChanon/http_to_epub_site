import { sql } from "drizzle-orm";
import { Data, Effect, Option } from "effect";
import { DB, DBLayer } from "../db.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import {
	MangaNativeService,
	type MangaProvider,
} from "../mangaNative/mangaNative.service.js";
import { S3Service } from "../s3/s3.service.js";
import { chapters, pages } from "../schema/providers.js";
import { SQLError, toSQLError } from "../schema/utils.js";
import { ProviderRepository } from "./provider.repository.js";
import {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
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

export class ScanProviderService extends Effect.Service<ScanProviderService>()(
	"api/ScanProviderService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;
			const s3 = yield* S3Service;
			const mangaNative = yield* MangaNativeService;
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

			function toChapterSummary(row: {
				readonly number: number;
				readonly createdAt: Date;
				readonly pages: readonly unknown[];
			}) {
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
					const rows = yield* db.query.chapters
						.findMany({
							where: { mangaId: mangaDbId },
							with: { pages: true, provider: true },
							orderBy: { number: "asc" },
						})
						.pipe(Effect.mapError(toSQLError));

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
							new MangaProviderChapters({ provider, chapters }),
					);
				});
			}

			function getChapterPages(
				mangaDbId: MangaDbId,
				provider: MangaProvider,
				chapterNumber: number,
			) {
				return Effect.gen(function* () {
					const providerId = yield* resolveProviderId(mangaDbId, provider);

					const [chapterRow, nextChapterRow] = yield* Effect.all([
						db.query.chapters
							.findFirst({
								where: {
									mangaId: mangaDbId,
									providerId,
									number: chapterNumber,
								},
								with: { pages: true },
							})
							.pipe(Effect.mapError(toSQLError)),
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

					if (!chapterRow) {
						return yield* Effect.fail(
							new ChapterNotFound({
								mangaId: mangaDbId,
								provider,
								number: chapterNumber,
							}),
						);
					}

					const sortedPages = chapterRow.pages
						.slice()
						.sort((a, b) => a.number - b.number);

					const pageUrls = yield* Effect.forEach(
						sortedPages,
						(page) => s3.getUrl(page.path),
						{ concurrency: 5 },
					);

					return new ChapterPages({
						pages: pageUrls,
						hasNextChapter: nextChapterRow !== undefined,
					});
				});
			}

			return {
				syncMangaChapters,
				listChapterNumbers,
				listMangaProviders,
				getChapterPages,
			} as const;
		}),
		dependencies: [
			DBLayer,
			S3Service.Default,
			MangaNativeService.Default,
			ProviderRepository.Default,
		],
	},
) {}
