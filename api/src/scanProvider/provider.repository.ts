import { Effect, Option } from "effect";
import type { MangaProvider } from "manga-native";
import { DB, DBLayer } from "../db.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import { mangaProviders, providers } from "../schema/providers.js";
import { SQLError, toSQLError } from "../schema/utils.js";
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

			function ensureMangaProviderLink(
				mangaDbId: MangaDbId,
				name: MangaProvider,
			) {
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
								const providerId = row.id;

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
				});
			}

			return { findProviderIdByName, ensureMangaProviderLink } as const;
		}),
		dependencies: [DBLayer],
	},
) {}
