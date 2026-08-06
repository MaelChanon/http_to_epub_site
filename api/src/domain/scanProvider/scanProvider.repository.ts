import { Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import type { MangaDbId } from "../manga/manga.domain.js";

export class ScanProviderRepository extends Effect.Service<ScanProviderRepository>()(
	"api/ScanProviderRepository",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;

			function findChaptersInRange(
				mangaDbId: MangaDbId,
				providerId: string,
				chapterStart: number,
				chapterEnd: number,
			) {
				return db.query.chapters
					.findMany({
						where: {
							mangaId: mangaDbId,
							providerId,
							number: { gte: chapterStart, lte: chapterEnd },
						},
						with: { pages: true },
						orderBy: { number: "asc" },
					})
					.pipe(Effect.mapError(toSQLError));
			}

			return { findChaptersInRange } as const;
		}),
		dependencies: [DBLayer],
	},
) {}
