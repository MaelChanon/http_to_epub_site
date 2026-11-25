import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Clock, Context, Data, Effect, Layer, Semaphore } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import {
	AnimeSama,
	type BuildError,
	Chapter,
	type Clearance,
	collectPages,
	EpubBuilder,
	Fetcher,
	fetchDocument,
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
	WeebCentral,
} from "effect_http_to_epub";
import { ProviderProxyService } from "../providerProxy/providerProxy.service.js";

export type { Clearance };

const SITES = {
	SUSHISCAN: {
		layer: SushiScan,
		baseUrl: "https://sushiscan.fr",
		lang: "fr-FR",
	},
	SUSHISCAN_NET: {
		layer: SushiScanNet,
		baseUrl: "https://sushiscan.net",
		lang: "fr-FR",
	},
	MANGA_ORIGINS: {
		layer: MangaOrigins,
		baseUrl: "https://mangas-origines.fr",
		lang: "fr-FR",
	},
	ANIME_SAMA: {
		layer: AnimeSama,
		baseUrl: "https://anime-sama.to",
		lang: "fr-FR",
	},
	WEEBCENTRAL: {
		layer: WeebCentral,
		baseUrl: "https://weebcentral.com",
		lang: "en-US",
	},
};

// Crawl-delay the library applies to weebcentral, but per site layer only.
const WEEBCENTRAL_CRAWL_DELAY_MILLIS = 10_000;
const WEEBCENTRAL_PAGE_SIZE = 32;

export type MangaProvider = keyof typeof SITES;

/**
 * The provider's base URL: the one to hand a Cloudflare challenge solver
 * (`cf_clearance` covers the whole domain, image CDN included).
 */
export const getProviderBaseUrl = (provider: MangaProvider) =>
	SITES[provider].baseUrl;

/** The language the provider's scans are in. */
export const getProviderLang = (provider: MangaProvider) =>
	SITES[provider].lang;

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

/** Spaces requests out: one at a time, `delayMillis` after the previous one. */
const makePacer = Effect.fnUntraced(function* (delayMillis: number) {
	const semaphore = yield* Semaphore.make(1);
	let next = 0;
	const waitForTurn = Effect.gen(function* () {
		const wait = next - (yield* Clock.currentTimeMillis);
		if (wait > 0) {
			yield* Effect.sleep(wait);
		}
	});
	const endTurn = Effect.map(Clock.currentTimeMillis, (now) => {
		next = now + delayMillis;
	});
	return <A, E, R>(request: Effect.Effect<A, E, R>) =>
		semaphore.withPermit(
			Effect.andThen(waitForTurn, Effect.ensuring(request, endTurn)),
		);
});

/**
 * The library's `getAllMangas` makes two more requests per series: 10 s apart,
 * over 10 000 series, it would take days. The listing pages alone (about an
 * hour) give the tags and names, but no chapter count or cover.
 */
const listWeebCentral = Effect.gen(function* () {
	const names = new Map<string, string>();
	yield* collectPages((page) => {
		const query = new URLSearchParams({
			limit: String(WEEBCENTRAL_PAGE_SIZE),
			offset: String(page * WEEBCENTRAL_PAGE_SIZE),
			sort: "Alphabet",
			order: "Ascending",
			official: "Any",
			anime: "Any",
			adult: "Any",
			display_mode: "Minimal Display",
		});
		return Effect.map(
			fetchDocument(`${SITES.WEEBCENTRAL.baseUrl}/search/data?${query}`),
			(doc) =>
				doc.root.querySelectorAll('a[href*="/series/"]').flatMap((link) => {
					// Series links end with an optional slug: /series/<id>/<slug>
					const tag = /\/series\/([^/?#]+)/.exec(
						link.getAttribute("href") ?? "",
					)?.[1];
					const name = link.text.trim();
					if (tag === undefined || name === "") {
						return [];
					}
					names.set(tag, name);
					return [tag];
				}),
		);
	}, 0);
	return [...names].map(
		([tag, name]) =>
			new MangaInfo({ tag, name, coverUrl: "", chapterCount: 0 }),
	);
});

const make = Effect.gen(function* () {
	const providerProxy = yield* ProviderProxyService;
	const epubBuilder = yield* EpubBuilder;
	const paceWeebCentral = yield* makePacer(WEEBCENTRAL_CRAWL_DELAY_MILLIS);

	const fetcherLayer = (provider: MangaProvider) => {
		const layer = Fetcher.layer().pipe(
			Layer.provide(
				Layer.succeed(
					HttpClient.HttpClient,
					providerProxy.httpClient(provider),
				),
			),
		);
		if (provider !== "WEEBCENTRAL") {
			return layer;
		}
		return Layer.effect(
			Fetcher,
			Effect.map(Fetcher, (fetcher) =>
				Fetcher.of({
					...fetcher,
					text: (url, options) => paceWeebCentral(fetcher.text(url, options)),
				}),
			),
		).pipe(Layer.provide(layer));
	};

	const withSite = <A>(
		provider: MangaProvider,
		clearance: Clearance | undefined,
		use: (site: Provider["Service"]) => Effect.Effect<A, ProviderError>,
	) => {
		const { layer, baseUrl } = SITES[provider];
		const siteLayer = layer(baseUrl, clearance).pipe(
			Layer.provide(fetcherLayer(provider)),
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

	const getWeebCentralCatalog = (clearance?: Clearance) => {
		const session = makeSession(SITES.WEEBCENTRAL.baseUrl, clearance);
		return listWeebCentral.pipe(
			Effect.updateService(Fetcher, (fetcher) =>
				Fetcher.of({
					...fetcher,
					text: (url, options) =>
						fetcher.text(url, {
							...options,
							headers: { ...headersFor(session, url), ...options?.headers },
						}),
				}),
			),
			Effect.provide(fetcherLayer("WEEBCENTRAL")),
			Effect.mapError(toFetchFailed),
		);
	};

	const getProviderCatalog = (
		provider: MangaProvider,
		clearance?: Clearance,
	) =>
		provider === "WEEBCENTRAL"
			? getWeebCentralCatalog(clearance)
			: withSite(provider, clearance, (site) => site.getAllMangas());

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
