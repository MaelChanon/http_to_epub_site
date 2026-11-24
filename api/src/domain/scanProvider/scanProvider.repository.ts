import { Context, Effect, Layer } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import type { MangaDbId } from "../manga/manga.domain.js";

const make = Effect.gen(function* () {
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

	return { findChaptersInRange };
});

export class ScanProviderRepository extends Context.Service<ScanProviderRepository>()(
	"api/ScanProviderRepository",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(DBLayer),
	);
}
