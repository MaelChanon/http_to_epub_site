import { Data, Effect } from "effect";
import {
	type MangaCatalogEntry,
	type MangaChapter,
	type MangaProvider,
	getMangaChapters as nativeGetMangaChapters,
	getProviderCatalog as nativeGetProviderCatalog,
} from "manga-native";

export type { MangaCatalogEntry, MangaChapter, MangaProvider };

export class MangaNativeFetchFailed extends Data.TaggedError(
	"MangaNativeFetchFailed",
)<{ readonly message: string }> {
	get internalMessage() {
		return `manga-native fetch failed: ${this.message}`;
	}
}

export class MangaNativeService extends Effect.Service<MangaNativeService>()(
	"api/MangaNativeService",
	{
		effect: Effect.gen(function* () {
			function getMangaChapters(slug: string, provider: MangaProvider) {
				return Effect.tryPromise({
					try: () => nativeGetMangaChapters(slug, provider),
					catch: (e) =>
						new MangaNativeFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			function getProviderCatalog(provider: MangaProvider) {
				return Effect.tryPromise({
					try: () => nativeGetProviderCatalog(provider),
					catch: (e) =>
						new MangaNativeFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			return {
				getMangaChapters,
				getProviderCatalog,
			} as const;
		}),
	},
) {}
