import { Data, Effect } from "effect";
import {
	type BuildEpubInput,
	type BuildEpubOutput,
	CLEARANCE_REQUIRED_MARKER,
	type Clearance,
	getProviderBaseUrl,
	type MangaCatalogEntry,
	type MangaChapter,
	type MangaProvider,
	buildEpub as nativeBuildEpub,
	getMangaChapters as nativeGetMangaChapters,
	getPageRequestHeaders as nativeGetPageRequestHeaders,
	getProviderCatalog as nativeGetProviderCatalog,
} from "manga-fetcher";
import { ProviderProxyService } from "../providerProxy/providerProxy.service.js";

export type {
	BuildEpubInput,
	BuildEpubOutput,
	Clearance,
	MangaCatalogEntry,
	MangaChapter,
	MangaProvider,
};
export { getProviderBaseUrl };

export class MangaFetcherFetchFailed extends Data.TaggedError(
	"MangaFetcherFetchFailed",
)<{ readonly message: string }> {
	get internalMessage() {
		return `manga-fetcher fetch failed: ${this.message}`;
	}

	/** Cloudflare is challenging: only a fresh clearance can make a retry succeed. */
	get needsClearance() {
		return this.message.includes(CLEARANCE_REQUIRED_MARKER);
	}
}

export class MangaFetcherService extends Effect.Service<MangaFetcherService>()(
	"api/MangaFetcherService",
	{
		effect: Effect.gen(function* () {
			const providerProxy = yield* ProviderProxyService;

			// The provider's proxy, if it needs one, is applied here so that no
			// caller can forget it.
			const access = (provider: MangaProvider, clearance?: Clearance) => ({
				clearance,
				proxyUrl: providerProxy.proxyUrl(provider),
			});

			function getMangaChapters(
				slug: string,
				provider: MangaProvider,
				clearance?: Clearance,
			) {
				return Effect.tryPromise({
					try: () =>
						nativeGetMangaChapters(slug, provider, access(provider, clearance)),
					catch: (e) =>
						new MangaFetcherFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			function getProviderCatalog(
				provider: MangaProvider,
				clearance?: Clearance,
			) {
				return Effect.tryPromise({
					try: () =>
						nativeGetProviderCatalog(provider, access(provider, clearance)),
					catch: (e) =>
						new MangaFetcherFetchFailed({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			// Synchronous on the native side (no I/O), so `try` rather than `tryPromise`:
			// it only throws on an unknown provider name.
			function getPageRequestHeaders(
				provider: MangaProvider,
				clearance?: Clearance,
			) {
				return Effect.try({
					try: () => nativeGetPageRequestHeaders(provider, clearance),
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
				getPageRequestHeaders,
				buildEpub,
			} as const;
		}),
		dependencies: [ProviderProxyService.Default],
	},
) {}
