import { Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
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

			return { toManga, listWithEpubsForUser } as const;
		}),
		dependencies: [DBLayer],
	},
) {}
