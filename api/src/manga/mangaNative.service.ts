import { Data, Effect } from "effect";
import {
	type MangaChapter,
	type MangaProvider,
	getMangaChapters as nativeGetMangaChapters,
} from "manga-native";

export type { MangaChapter, MangaProvider };

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

			return { getMangaChapters } as const;
		}),
	},
) {}
