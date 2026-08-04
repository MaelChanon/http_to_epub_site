import { sql } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { MangaProvider } from "manga-fetcher";
import { DB, DBLayer } from "../../../drizzle/db.js";
import {
	mangaProviders,
	providers,
} from "../../../drizzle/schema/providers.js";
import { SQLError, toSQLError } from "../../../drizzle/schema/utils.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import type { MangaProviderName } from "./scanProvider.domain.js";

export class ProviderRepository extends Effect.Service<ProviderRepository>()(
	"api/ProviderRepository",
	{
		effect: Effect.gen(function* () {
			function findProviderIdByName(name: MangaProviderName) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const row = yield* db.query.providers
						.findFirst({ where: { name } })
						.pipe(Effect.mapError(toSQLError));
					return Option.fromNullable(row?.id);
				});
			}

			function ensureProvider(name: MangaProviderName) {
				return Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.transaction((tx) =>
							Effect.gen(function* () {
								const existing = yield* findProviderIdByName(name);
								if (Option.isSome(existing)) {
									return existing.value;
								}

								const inserted = yield* tx
									.insert(providers)
									.values({ name })
									.onConflictDoNothing({ target: providers.name })
									.returning()
									.pipe(Effect.mapError(toSQLError));

								if (inserted[0]) {
									return inserted[0].id;
								}

								const row = yield* db.query.providers
									.findFirst({ where: { name } })
									.pipe(Effect.mapError(toSQLError));

								if (!row) {
									return yield* Effect.fail(
										new SQLError({
											message: `provider "${name}" missing after conflict`,
										}),
									);
								}
								return row.id;
							}),
						)
						.pipe(Effect.catchTag("SqlError", toSQLError));
				});
			}

			function ensureMangaProviderLink(
				mangaDbId: MangaDbId,
				name: MangaProvider,
				tag: string,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const providerId = yield* ensureProvider(name);

					yield* db
						.insert(mangaProviders)
						.values({ mangaId: mangaDbId, providerId, tag })
						.onConflictDoUpdate({
							target: [mangaProviders.mangaId, mangaProviders.providerId],
							set: { tag: sql`excluded.tag` },
						})
						.pipe(Effect.mapError(toSQLError));

					return providerId;
				});
			}

			function hasMangaProviderLink(
				mangaDbId: MangaDbId,
				name: MangaProviderName,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const providerId = yield* findProviderIdByName(name);
					if (Option.isNone(providerId)) {
						return false;
					}

					const row = yield* db.query.mangaProviders
						.findFirst({
							where: { mangaId: mangaDbId, providerId: providerId.value },
						})
						.pipe(Effect.mapError(toSQLError));

					return row !== undefined;
				});
			}

			return {
				findProviderIdByName,
				ensureProvider,
				ensureMangaProviderLink,
				hasMangaProviderLink,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
