import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { favorites } from "../../../drizzle/schema/favorites.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import {
	AniListId,
	MangaStaff,
} from "../mangaProvider/mangaProvider.domain.js";
import type { UserId } from "../user/user.domain.js";
import { Manga, MangaDbId } from "./manga.domain.js";

export class MangaRepository extends Effect.Service<MangaRepository>()(
	"api/MangaRepository",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;

			type MangaRow = NonNullable<
				Effect.Effect.Success<
					ReturnType<
						typeof db.query.mangas.findFirst<{
							with: { staff: true; genres: true };
						}>
					>
				>
			>;

			function toManga(row: MangaRow, isFavorite: boolean) {
				return Effect.succeed(
					new Manga({
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
						summary: row.summary,
						coverUrl: `/api/manga/${row.mangaId}/cover`,
						staff: row.staff.map(
							(s) => new MangaStaff({ name: s.name, role: s.role }),
						),
						genres: row.genres.map((g) => g.genre),
						isFavorite,
					}),
				);
			}

			function listWithEpubsForUser(userId: UserId) {
				return db.query.mangas
					.findMany({
						with: {
							epubs: {
								where: { userId },
								with: { provider: true },
								orderBy: { createdAt: "desc" },
							},
						},
					})
					.pipe(Effect.mapError(toSQLError));
			}

			function addFavorite(userId: UserId, mangaId: MangaDbId) {
				return db
					.insert(favorites)
					.values({ userId, mangaId })
					.onConflictDoNothing()
					.pipe(Effect.mapError(toSQLError), Effect.asVoid);
			}

			function removeFavorite(userId: UserId, mangaId: MangaDbId) {
				return db
					.delete(favorites)
					.where(
						and(eq(favorites.userId, userId), eq(favorites.mangaId, mangaId)),
					)
					.pipe(Effect.mapError(toSQLError), Effect.asVoid);
			}

			function isFavorite(userId: UserId, mangaId: MangaDbId) {
				return db.query.favorites
					.findFirst({ where: { userId, mangaId } })
					.pipe(
						Effect.mapError(toSQLError),
						Effect.map((row) => row !== undefined),
					);
			}

			function listFavoriteIds(userId: UserId) {
				return db.query.favorites.findMany({ where: { userId } }).pipe(
					Effect.mapError(toSQLError),
					Effect.map(
						(rows): ReadonlySet<MangaDbId> =>
							new Set(rows.map((row) => row.mangaId as MangaDbId)),
					),
				);
			}

			return {
				toManga,
				listWithEpubsForUser,
				addFavorite,
				removeFavorite,
				isFavorite,
				listFavoriteIds,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
