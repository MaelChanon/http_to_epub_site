import { and, eq, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { Context, Effect, Layer, Option } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import {
	mangaProviders,
	providers,
} from "../../../drizzle/schema/providers.js";
import {
	catchSqlError,
	SQLError,
	toSQLError,
} from "../../../drizzle/schema/utils.js";
import { MangaDbId } from "../manga/manga.domain.js";
import type { MangaProvider } from "../mangaFetcher/mangaFetcher.service.js";
import {
	type MangaProviderName,
	type MangaProviderStatus,
	staleTransitionCutoff,
	TRANSITIONING_STATUSES,
} from "./scanProvider.domain.js";

// A link is takeable when nothing owns it, or when its owner went stale.
// Evaluated inside the statement that takes it, so concurrent callers
// serialize on the row lock instead of racing between read and write.
const isTakeable = () =>
	or(
		notInArray(mangaProviders.status, [...TRANSITIONING_STATUSES]),
		lt(mangaProviders.updatedAt, staleTransitionCutoff()),
	);

const linkOf = (mangaDbId: MangaDbId, providerId: string) =>
	and(
		eq(mangaProviders.mangaId, mangaDbId),
		eq(mangaProviders.providerId, providerId),
	);

const make = Effect.gen(function* () {
	const db = yield* DB;

	const findProviderIdByName = (name: MangaProviderName) =>
		db.query.providers.findFirst({ where: { name } }).pipe(
			Effect.mapError(toSQLError),
			Effect.map((row) => Option.fromNullishOr(row?.id)),
		);

	const ensureProvider = (name: MangaProviderName) =>
		db
			.transaction(
				Effect.fn(function* (tx) {
					const existing = yield* findProviderIdByName(name);
					if (Option.isSome(existing)) {
						return existing.value;
					}

					const [inserted] = yield* tx
						.insert(providers)
						.values({ name })
						.onConflictDoNothing({ target: providers.name })
						.returning()
						.pipe(Effect.mapError(toSQLError));
					if (inserted) {
						return inserted.id;
					}

					const row = yield* tx.query.providers
						.findFirst({ where: { name } })
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* new SQLError({
							message: `provider "${name}" missing after conflict`,
						});
					}
					return row.id;
				}),
			)
			.pipe(catchSqlError);

	/** Takes the link for a sync; `None` when someone else holds it. */
	const acquireMangaProviderLink = Effect.fn(
		"ProviderRepository.acquireMangaProviderLink",
	)(function* (
		mangaDbId: MangaDbId,
		name: MangaProvider,
		tag: string,
		status: MangaProviderStatus,
	) {
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

		return rows.length > 0 ? Option.some(providerId) : Option.none<string>();
	});

	/** Takes the link for a deletion; `false` when someone else holds it. */
	const acquireMangaProviderDeletion = (
		mangaDbId: MangaDbId,
		providerId: string,
	) =>
		db
			.update(mangaProviders)
			.set({ status: "DELETING", updatedAt: new Date() })
			.where(and(linkOf(mangaDbId, providerId), isTakeable()))
			.returning({ providerId: mangaProviders.providerId })
			.pipe(
				Effect.mapError(toSQLError),
				Effect.map((rows) => rows.length > 0),
			);

	const touchMangaProviderLink = (mangaDbId: MangaDbId, providerId: string) =>
		db
			.update(mangaProviders)
			.set({ updatedAt: new Date() })
			.where(linkOf(mangaDbId, providerId))
			.pipe(Effect.mapError(toSQLError), Effect.asVoid);

	const failStaleTransitions = () =>
		db
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

	const listProviders = () =>
		db.query.providers.findMany().pipe(Effect.mapError(toSQLError));

	const setStatus = (
		mangaDbId: MangaDbId,
		providerId: string,
		status: MangaProviderStatus,
	) =>
		db
			.update(mangaProviders)
			.set({ status, updatedAt: new Date() })
			.where(linkOf(mangaDbId, providerId))
			.pipe(Effect.mapError(toSQLError), Effect.asVoid);

	const deleteMangaProviderLink = (mangaDbId: MangaDbId, providerId: string) =>
		db
			.delete(mangaProviders)
			.where(linkOf(mangaDbId, providerId))
			.pipe(Effect.mapError(toSQLError), Effect.asVoid);

	const findMangaProviderLink = Effect.fn(
		"ProviderRepository.findMangaProviderLink",
	)(function* (mangaDbId: MangaDbId, name: MangaProvider) {
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
		return Option.fromNullishOr(row).pipe(
			Option.map(({ status }) => ({ providerId: providerId.value, status })),
		);
	});

	const hasMangaProviderLink = (
		mangaDbId: MangaDbId,
		name: MangaProviderName,
	) => findMangaProviderLink(mangaDbId, name).pipe(Effect.map(Option.isSome));

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
	};
});

export class ProviderRepository extends Context.Service<ProviderRepository>()(
	"api/ProviderRepository",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(DBLayer),
	);
}
