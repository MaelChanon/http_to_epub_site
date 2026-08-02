import { sql } from "drizzle-orm";
import { Effect, Option } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { providerMangas } from "../../../drizzle/schema/providers.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import {
	MangaFetcherService,
	type MangaProvider,
} from "../mangaFetcher/mangaFetcher.service.js";
import { ProviderRepository } from "./provider.repository.js";
import type { MangaProviderName } from "./scanProvider.domain.js";
import { ProviderMangaSummary } from "./scanProvider.domain.js";

export class ProviderCatalogService extends Effect.Service<ProviderCatalogService>()(
	"api/ProviderCatalogService",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;
			const mangaFetcher = yield* MangaFetcherService;
			const providerRepo = yield* ProviderRepository;

			function refreshCatalog(provider: MangaProvider) {
				return Effect.gen(function* () {
					const providerId = yield* providerRepo.ensureProvider(provider);
					const entries = yield* mangaFetcher.getProviderCatalog(provider);

					if (entries.length === 0) {
						return;
					}

					yield* db
						.insert(providerMangas)
						.values(
							entries.map((entry) => ({
								providerId,
								tag: entry.tag,
								name: entry.name,
								coverUrl: entry.coverUrl,
								chapterCount: entry.chapterCount,
							})),
						)
						.onConflictDoUpdate({
							target: [providerMangas.providerId, providerMangas.tag],
							set: {
								name: sql`excluded.name`,
								updatedAt: sql`now()`,
							},
						})
						.pipe(Effect.mapError(toSQLError));
				});
			}

			// Lecture pure — ne crée jamais de ligne `providers` juste pour une recherche.
			function search(provider: MangaProviderName, query: string, limit = 50) {
				return Effect.gen(function* () {
					const providerIdOpt =
						yield* providerRepo.findProviderIdByName(provider);
					if (Option.isNone(providerIdOpt)) {
						return [];
					}

					const rows = yield* db.query.providerMangas
						.findMany({
							where: {
								providerId: providerIdOpt.value,
								name: { ilike: `%${query}%` },
							},
							orderBy: { name: "asc" },
							limit,
						})
						.pipe(Effect.mapError(toSQLError));

					return rows.map(
						(row) =>
							new ProviderMangaSummary({
								tag: row.tag,
								name: row.name,
								updatedAt: row.updatedAt,
							}),
					);
				});
			}

			return { refreshCatalog, search } as const;
		}),
		dependencies: [
			DBLayer,
			MangaFetcherService.Default,
			ProviderRepository.Default,
		],
	},
) {}
