import { Data, Effect } from "effect";
import {
	type BuildEpubInput,
	type BuildEpubOutput,
	type MangaCatalogEntry,
	type MangaChapter,
	type MangaProvider,
	buildEpub as nativeBuildEpub,
	getMangaChapters as nativeGetMangaChapters,
	getProviderCatalog as nativeGetProviderCatalog,
} from "manga-fetcher";

export type {
	BuildEpubInput,
	BuildEpubOutput,
	MangaCatalogEntry,
	MangaChapter,
	MangaProvider,
};

export class MangaFetcherFetchFailed extends Data.TaggedError(
	"MangaFetcherFetchFailed",
)<{ readonly message: string }> {
	get internalMessage() {
		return `manga-fetcher fetch failed: ${this.message}`;
	}
}

export class MangaFetcherService extends Effect.Service<MangaFetcherService>()(
	"api/MangaFetcherService",
	{
		effect: Effect.gen(function* () {
			function getMangaChapters(slug: string, provider: MangaProvider) {
				return Effect.tryPromise({
					try: () => nativeGetMangaChapters(slug, provider),
					catch: (e) =>
						new MangaFetcherFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			function getProviderCatalog(provider: MangaProvider) {
				return Effect.tryPromise({
					try: () => nativeGetProviderCatalog(provider),
					catch: (e) =>
						new MangaFetcherFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			function buildEpub(input: BuildEpubInput) {
				return Effect.tryPromise({
					try: () => nativeBuildEpub(input),
					catch: (e) =>
						new MangaFetcherFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			return {
				getMangaChapters,
				getProviderCatalog,
				buildEpub,
			} as const;
		}),
	},
) {}
