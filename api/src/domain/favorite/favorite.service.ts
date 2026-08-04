import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { favorites } from "../../../drizzle/schema/favorites.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import type { UserId } from "../user/user.domain.js";

export class FavoriteService extends Effect.Service<FavoriteService>()(
	"api/FavoriteService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;

			function add(userId: UserId, mangaId: MangaDbId) {
				return db
					.insert(favorites)
					.values({ userId, mangaId })
					.onConflictDoNothing()
					.pipe(Effect.mapError(toSQLError), Effect.asVoid);
			}

			function remove(userId: UserId, mangaId: MangaDbId) {
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

			function listMangaIds(userId: UserId) {
				return db.query.favorites.findMany({ where: { userId } }).pipe(
					Effect.mapError(toSQLError),
					Effect.map(
						(rows): ReadonlySet<MangaDbId> =>
							new Set(rows.map((row) => row.mangaId as MangaDbId)),
					),
				);
			}

			return { add, remove, isFavorite, listMangaIds } as const;
		}),
		dependencies: [DBLayer],
	},
) {}
