import { Context, Data, Effect, Layer } from "effect";
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

const toFetchFailed = (e: unknown) =>
	new MangaFetcherFetchFailed({
		message: e instanceof Error ? e.message : String(e),
	});

/** Turns a native call's rejection into a `MangaFetcherFetchFailed`. */
const native = <A>(call: () => Promise<A>) =>
	Effect.tryPromise({ try: call, catch: toFetchFailed });

const make = Effect.gen(function* () {
	const providerProxy = yield* ProviderProxyService;

	// The provider's proxy, if it needs one, is applied here so that no caller
	// can forget it.
	const access = (provider: MangaProvider, clearance?: Clearance) => ({
		clearance,
		proxyUrl: providerProxy.proxyUrl(provider),
	});

	const getMangaChapters = (
		slug: string,
		provider: MangaProvider,
		clearance?: Clearance,
	) =>
		native(() =>
			nativeGetMangaChapters(slug, provider, access(provider, clearance)),
		);

	const getProviderCatalog = (provider: MangaProvider, clearance?: Clearance) =>
		native(() =>
			nativeGetProviderCatalog(provider, access(provider, clearance)),
		);

	// Synchronous on the native side (no I/O), so `try` rather than `tryPromise`:
	// it only throws on an unknown provider name.
	const getPageRequestHeaders = (
		provider: MangaProvider,
		clearance?: Clearance,
	) =>
		Effect.try({
			try: () => nativeGetPageRequestHeaders(provider, clearance),
			catch: toFetchFailed,
		});

	const buildEpub = (input: BuildEpubInput) =>
		native(() => nativeBuildEpub(input));

	return {
		getMangaChapters,
		getProviderCatalog,
		getPageRequestHeaders,
		buildEpub,
	};
});

export class MangaFetcherService extends Context.Service<MangaFetcherService>()(
	"api/MangaFetcherService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(ProviderProxyService.Default),
	);
}
