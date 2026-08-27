import { and, eq, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { MangaProvider } from "manga-fetcher";
import { DB, DBLayer } from "../../../drizzle/db.js";
import {
	mangaProviders,
	providers,
} from "../../../drizzle/schema/providers.js";
import { SQLError, toSQLError } from "../../../drizzle/schema/utils.js";
import { MangaDbId } from "../manga/manga.domain.js";
import {
	type MangaProviderName,
	type MangaProviderStatus,
	staleTransitionCutoff,
	TRANSITIONING_STATUSES,
} from "./scanProvider.domain.js";

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

								const row = yield* tx.query.providers
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

			// A link is takeable when nothing owns it, or when its owner went stale.
			// Evaluated inside the statement that takes it, so concurrent callers
			// serialize on the row lock instead of racing between read and write.
			function isTakeable() {
				return or(
					notInArray(mangaProviders.status, [...TRANSITIONING_STATUSES]),
					lt(mangaProviders.updatedAt, staleTransitionCutoff()),
				);
			}

			function acquireMangaProviderLink(
				mangaDbId: MangaDbId,
				name: MangaProvider,
				tag: string,
				status: MangaProviderStatus,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const providerId = yield* ensureProvider(name);

					const rows = yield* db
						.insert(mangaProviders)
						.values({
							mangaId: mangaDbId,
							providerId,
							tag,
							status,
							updatedAt: new Date(),
						})
						.onConflictDoUpdate({
							target: [mangaProviders.mangaId, mangaProviders.providerId],
							set: {
								tag: sql`excluded.tag`,
								status: sql`excluded.status`,
								updatedAt: sql`excluded.updated_at`,
							},
							setWhere: isTakeable(),
						})
						.returning({ providerId: mangaProviders.providerId })
						.pipe(Effect.mapError(toSQLError));

					return rows.length > 0
						? Option.some(providerId)
						: Option.none<string>();
				});
			}

			function acquireMangaProviderDeletion(
				mangaDbId: MangaDbId,
				providerId: string,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const rows = yield* db
						.update(mangaProviders)
						.set({ status: "DELETING", updatedAt: new Date() })
						.where(
							and(
								eq(mangaProviders.mangaId, mangaDbId),
								eq(mangaProviders.providerId, providerId),
								isTakeable(),
							),
						)
						.returning({ providerId: mangaProviders.providerId })
						.pipe(Effect.mapError(toSQLError));

					return rows.length > 0;
				});
			}

			function touchMangaProviderLink(
				mangaDbId: MangaDbId,
				providerId: string,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.update(mangaProviders)
						.set({ updatedAt: new Date() })
						.where(
							and(
								eq(mangaProviders.mangaId, mangaDbId),
								eq(mangaProviders.providerId, providerId),
							),
						)
						.pipe(Effect.mapError(toSQLError));
				});
			}

			function failStaleTransitions() {
				return Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.update(mangaProviders)
						.set({ status: "FAILED", updatedAt: new Date() })
						.where(
							and(
								inArray(mangaProviders.status, [...TRANSITIONING_STATUSES]),
								lt(mangaProviders.updatedAt, staleTransitionCutoff()),
							),
						)
						.returning({
							mangaId: mangaProviders.mangaId,
							providerId: mangaProviders.providerId,
						})
						.pipe(
							Effect.mapError(toSQLError),
							Effect.map((rows) =>
								rows.map((row) => ({
									mangaId: MangaDbId.make(row.mangaId),
									providerId: row.providerId,
								})),
							),
						);
				});
			}

			function listProviders() {
				return Effect.gen(function* () {
					const db = yield* DB;
					return yield* db.query.providers
						.findMany()
						.pipe(Effect.mapError(toSQLError));
				});
			}

			function setStatus(
				mangaDbId: MangaDbId,
				providerId: string,
				status: MangaProviderStatus,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.update(mangaProviders)
						.set({ status, updatedAt: new Date() })
						.where(
							and(
								eq(mangaProviders.mangaId, mangaDbId),
								eq(mangaProviders.providerId, providerId),
							),
						)
						.pipe(Effect.mapError(toSQLError));
				});
			}

			function deleteMangaProviderLink(
				mangaDbId: MangaDbId,
				providerId: string,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.delete(mangaProviders)
						.where(
							and(
								eq(mangaProviders.mangaId, mangaDbId),
								eq(mangaProviders.providerId, providerId),
							),
						)
						.pipe(Effect.mapError(toSQLError));
				});
			}

			function findMangaProviderLink(
				mangaDbId: MangaDbId,
				name: MangaProvider,
			) {
				return Effect.gen(function* () {
					const db = yield* DB;
					const providerId = yield* findProviderIdByName(name);
					if (Option.isNone(providerId)) {
						return Option.none<{
							providerId: string;
							status: MangaProviderStatus;
						}>();
					}

					const row = yield* db.query.mangaProviders
						.findFirst({
							where: { mangaId: mangaDbId, providerId: providerId.value },
						})
						.pipe(Effect.mapError(toSQLError));

					return row
						? Option.some({ providerId: providerId.value, status: row.status })
						: Option.none<{
								providerId: string;
								status: MangaProviderStatus;
							}>();
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
				listProviders,
				ensureProvider,
				acquireMangaProviderLink,
				acquireMangaProviderDeletion,
				touchMangaProviderLink,
				failStaleTransitions,
				setStatus,
				deleteMangaProviderLink,
				hasMangaProviderLink,
				findMangaProviderLink,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
