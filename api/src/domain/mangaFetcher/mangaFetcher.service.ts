import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Context, Data, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import {
	AnimeSama,
	type BuildError,
	Chapter,
	type Clearance,
	EpubBuilder,
	Fetcher,
	headersFor,
	ImageProcessor,
	MangaInfo,
	MangaOrigins,
	makeSession,
	type OutputError,
	Provider,
	type ProviderError,
	SushiScan,
	SushiScanNet,
	toFile,
	USER_AGENT,
} from "effect_http_to_epub";
import { ProviderProxyService } from "../providerProxy/providerProxy.service.js";

export type { Clearance };

const SITES = {
	SUSHISCAN: { layer: SushiScan, baseUrl: "https://sushiscan.fr" },
	SUSHISCAN_NET: { layer: SushiScanNet, baseUrl: "https://sushiscan.net" },
	MANGA_ORIGINS: { layer: MangaOrigins, baseUrl: "https://mangas-origines.fr" },
	ANIME_SAMA: { layer: AnimeSama, baseUrl: "https://anime-sama.to" },
};

export type MangaProvider = keyof typeof SITES;

/**
 * The provider's base URL: the one to hand a Cloudflare challenge solver
 * (`cf_clearance` covers the whole domain, image CDN included).
 */
export const getProviderBaseUrl = (provider: MangaProvider) =>
	SITES[provider].baseUrl;

export interface BuildEpubInput {
	readonly tag: string;
	readonly name: string;
	/** Presigned URL to our own S3, like every page URL. */
	readonly coverUrl: string;
	readonly creator: string;
	readonly lang: string;
	readonly width: number;
	readonly height: number;
	readonly splitDoublePage: boolean;
	readonly chapters: readonly {
		readonly chapterNumber: number;
		readonly pages: readonly string[];
	}[];
	/** Absolute path to write the .epub file to. */
	readonly outputPath: string;
}

export class MangaFetcherFetchFailed extends Data.TaggedError(
	"MangaFetcherFetchFailed",
)<{
	readonly message: string;
	/** Cloudflare is challenging: only a fresh clearance can make a retry succeed. */
	readonly needsClearance: boolean;
}> {
	get internalMessage() {
		return `manga fetcher failed: ${this.message}`;
	}
}

type LibraryError = ProviderError | BuildError | OutputError;

const describe = (error: LibraryError) => {
	if (error._tag === "ClearanceRequired") {
		return `cloudflare is challenging on ${error.url}`;
	}
	const message = error.message || error._tag;
	if (!("cause" in error) || error.cause === undefined) {
		return message;
	}
	const cause =
		error.cause instanceof Error ? error.cause.message : String(error.cause);
	return `${message}: ${cause}`;
};

const toFetchFailed = (error: LibraryError) =>
	new MangaFetcherFetchFailed({
		message: describe(error),
		needsClearance: error._tag === "ClearanceRequired",
	});

const make = Effect.gen(function* () {
	const providerProxy = yield* ProviderProxyService;
	const epubBuilder = yield* EpubBuilder;

	// Scraping goes through the provider's own client, so that no caller can
	// forget its proxy.
	const withSite = <A>(
		provider: MangaProvider,
		clearance: Clearance | undefined,
		use: (site: Provider["Service"]) => Effect.Effect<A, ProviderError>,
	) => {
		const { layer, baseUrl } = SITES[provider];
		const siteLayer = layer(baseUrl, clearance).pipe(
			Layer.provide(Fetcher.layer()),
			Layer.provide(
				Layer.succeed(
					HttpClient.HttpClient,
					providerProxy.httpClient(provider),
				),
			),
		);
		return Provider.use(use).pipe(
			Effect.provide(siteLayer),
			Effect.mapError(toFetchFailed),
		);
	};

	const getMangaChapters = (
		slug: string,
		provider: MangaProvider,
		clearance?: Clearance,
	) =>
		withSite(provider, clearance, (site) =>
			site.getMangaInfo(slug).pipe(Effect.flatMap(site.getChapters)),
		);

	const getProviderCatalog = (provider: MangaProvider, clearance?: Clearance) =>
		withSite(provider, clearance, (site) => site.getAllMangas());

	/**
	 * Headers to download a page image with. The `Referer` (hotlink protection)
	 * and the clearance are only added for URLs on the provider's own domain.
	 */
	const getPageRequestHeaders = (
		provider: MangaProvider,
		url: string,
		clearance?: Clearance,
	) => ({
		"user-agent": USER_AGENT,
		...headersFor(makeSession(getProviderBaseUrl(provider), clearance), url),
	});

	/** Builds an EPUB from already hosted pages and writes it to `outputPath`. */
	const buildEpub = (input: BuildEpubInput) =>
		epubBuilder
			.build(
				{
					info: new MangaInfo({
						tag: input.tag,
						name: input.name,
						coverUrl: input.coverUrl,
						chapterCount: input.chapters.length,
					}),
					chapters: input.chapters.map(
						({ chapterNumber, pages }) =>
							new Chapter({ number: chapterNumber, pages }),
					),
					creator: input.creator,
					lang: input.lang,
				},
				{
					width: input.width,
					height: input.height,
					splitDoublePages: input.splitDoublePage,
				},
			)
			.pipe(
				toFile(input.outputPath),
				Effect.provide([NodeFileSystem.layer, NodePath.layer]),
				Effect.mapError(toFetchFailed),
			);

	return {
		getMangaChapters,
		getProviderCatalog,
		getPageRequestHeaders,
		buildEpub,
	};
});

const EpubBuilderLive = EpubBuilder.layer().pipe(
	Layer.provide([Fetcher.layer(), ImageProcessor.sharp]),
	Layer.provide(FetchHttpClient.layer),
);

export class MangaFetcherService extends Context.Service<MangaFetcherService>()(
	"api/MangaFetcherService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([ProviderProxyService.Default, EpubBuilderLive]),
	);
}
