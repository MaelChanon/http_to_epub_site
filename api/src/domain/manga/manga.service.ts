import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import {
	mangaGenres,
	mangaStaff,
	mangas,
} from "../../../drizzle/schema/mangas.js";
import {
	getFirst,
	SQLError,
	toSQLError,
} from "../../../drizzle/schema/utils.js";
import { EpubRepository } from "../epub/epub.repository.js";
import { FavoriteService } from "../favorite/favorite.service.js";
import {
	AniListId,
	type MangaProviderData,
} from "../mangaProvider/mangaProvider.domain.js";
import { S3Service } from "../s3/s3.service.js";
import type { UserId } from "../user/user.domain.js";
import { MangaDbId, MangaSummary, MangaWithEpub } from "./manga.domain.js";
import { MangaRepository } from "./manga.repository.js";

export class MangaNotFound extends Data.TaggedError("MangaNotFound")<{
	readonly mangaId: AniListId;
}> {
	get internalMessage() {
		return `Manga with mangaId=${this.mangaId} not found`;
	}
}

export class MangaService extends Effect.Service<MangaService>()(
	"api/MangaService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;
			const s3 = yield* S3Service;
			const epubRepo = yield* EpubRepository;
			const favoriteService = yield* FavoriteService;
			const mangaRepo = yield* MangaRepository;

			function getCoverPresignedUrl(mangaId: AniListId) {
				return Effect.gen(function* () {
					const row = yield* db.query.mangas
						.findFirst({ where: { mangaId } })
						.pipe(Effect.mapError(toSQLError));

					if (!row) {
						return yield* Effect.fail(new MangaNotFound({ mangaId }));
					}

					return yield* s3.manga.getUrl(row.path);
				});
			}

			function getManga(mangaId: AniListId, userId: UserId) {
				return Effect.gen(function* () {
					const row = yield* db.query.mangas
						.findFirst({
							where: { mangaId },
							with: {
								staff: true,
								genres: true,
								epubs: {
									where: { userId },
									with: { provider: true },
								},
							},
						})
						.pipe(Effect.mapError(toSQLError));

					if (!row) {
						return yield* Effect.fail(new MangaNotFound({ mangaId }));
					}

					const isFavorite = yield* favoriteService.isFavorite(
						userId,
						MangaDbId.make(row.id),
					);

					const manga = yield* mangaRepo.toManga(row, isFavorite);

					return new MangaWithEpub({
						...manga,
						epubs: row.epubs.map((epub) => epubRepo.toEpub(epub)),
					});
				});
			}

			function listMangas(userId: UserId) {
				return Effect.gen(function* () {
					const rows = yield* db.query.mangas
						.findMany({
							with: {
								genres: true,
								providers: { with: { provider: true } },
								chapters: true,
							},
						})
						.pipe(Effect.mapError(toSQLError));

					const favoriteIds = yield* favoriteService.listMangaIds(userId);

					return rows.map((row) => {
						const latestChapterAt = row.chapters.reduce<Date | null>(
							(latest, chapter) =>
								!latest || chapter.createdAt > latest
									? chapter.createdAt
									: latest,
							null,
						);

						return new MangaSummary({
							id: MangaDbId.make(row.id),
							mangaId: AniListId.make(row.mangaId),
							titleRomaji: row.titleRomaji,
							titleEnglish: row.titleEnglish,
							titleNative: row.titleNative,
							format: row.format,
							status: row.status,
							publishedAt: row.publishedAt,
							totalChapters: row.totalChapters,
							score: row.score,
							coverUrl: `/api/manga/${row.mangaId}/cover`,
							genres: row.genres.map((g) => g.genre),
							providers: row.providers.map((p) => p.provider.name),
							isFavorite: favoriteIds.has(MangaDbId.make(row.id)),
							latestChapterAt,
						});
					});
				});
			}

			function createManga(data: MangaProviderData, userId: UserId) {
				return db
					.transaction((tx) =>
						Effect.gen(function* () {
							const existing = yield* tx.query.mangas
								.findFirst({ where: { mangaId: data.mangaId } })
								.pipe(Effect.mapError(toSQLError));

							const mangaDbId = existing?.id ?? crypto.randomUUID();
							const path = `${mangaDbId}/cover.${new URL(data.coverImageUrl).pathname.split(".").pop() || "jpg"}`;

							const values = {
								id: mangaDbId,
								mangaId: data.mangaId,
								path,
								titleRomaji: data.titleRomaji,
								titleEnglish: data.titleEnglish,
								titleNative: data.titleNative,
								format: data.format,
								status: data.status,
								publishedAt: data.publishedAt,
								totalChapters: data.totalChapters,
								score: data.score,
								summary: data.summary,
							};

							const manga = yield* tx
								.insert(mangas)
								.values(values)
								.onConflictDoUpdate({ target: mangas.mangaId, set: values })
								.returning()
								.pipe(
									Effect.mapError(toSQLError),
									getFirst(new SQLError({ message: "failed to create manga" })),
								);
							yield* Effect.all([
								tx.delete(mangaStaff).where(eq(mangaStaff.mangaId, manga.id)),
								tx.delete(mangaGenres).where(eq(mangaGenres.mangaId, manga.id)),
							]).pipe(Effect.mapError(toSQLError));

							if (data.staff.length > 0) {
								yield* tx
									.insert(mangaStaff)
									.values(
										data.staff.map((staff) => ({
											mangaId: manga.id,
											name: staff.name,
											role: staff.role,
										})),
									)
									.pipe(Effect.mapError(toSQLError));
							}

							if (data.genres.length > 0) {
								yield* tx
									.insert(mangaGenres)
									.values(
										data.genres.map((genre) => ({ mangaId: manga.id, genre })),
									)
									.pipe(Effect.mapError(toSQLError));
							}

							yield* s3.manga.fetchAndUpload(path, data.coverImageUrl);

							return yield* getManga(AniListId.make(manga.mangaId), userId);
						}),
					)
					.pipe(Effect.catchTag("SqlError", toSQLError));
			}

			return {
				createManga,
				getManga,
				listMangas,
				getCoverPresignedUrl,
			} as const;
		}),
		dependencies: [
			DBLayer,
			S3Service.Default,
			FavoriteService.Default,
			EpubRepository.Default,
			MangaRepository.Default,
		],
	},
) {}
