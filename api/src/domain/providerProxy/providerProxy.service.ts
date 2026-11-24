import { NodeHttpClient } from "@effect/platform-node";
import Undici from "@effect/platform-node/Undici";
import { Context, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { appConfig } from "../../config.js";
import type { MangaProvider } from "../mangaFetcher/mangaFetcher.service.js";

const make = Effect.gen(function* () {
	const config = yield* appConfig;
	const directClient = yield* HttpClient.HttpClient;

	const proxyUrls = new Map<MangaProvider, string>();
	if (config.animeSamaProxyUrl !== "") {
		proxyUrls.set("ANIME_SAMA", config.animeSamaProxyUrl);
	}

	const proxiedClients = new Map<MangaProvider, HttpClient.HttpClient>();
	for (const [provider, url] of proxyUrls) {
		const agent = yield* Effect.acquireRelease(
			Effect.sync(() => new Undici.ProxyAgent(url)),
			(agent) => Effect.promise(() => agent.close()),
		);
		const client = yield* NodeHttpClient.makeUndici.pipe(
			Effect.provideService(NodeHttpClient.Dispatcher, agent),
		);
		proxiedClients.set(provider, client);
		yield* Effect.logInfo(`provider ${provider} goes through a proxy`);
	}

	/** The proxy the provider's scraping must go through, if any. */
	const proxyUrl = (provider: MangaProvider) => proxyUrls.get(provider);

	/** The HTTP client to download the provider's images with. */
	const httpClient = (provider: MangaProvider) =>
		proxiedClients.get(provider) ?? directClient;

	return { proxyUrl, httpClient };
});

/**
 * Which providers must be reached through a proxy, because they ban the
 * server's own IP (anime-sama blocks hosting providers' ranges outright, a
 * Cloudflare block that no challenge solver gets past). Everything that talks
 * to such a provider must leave through the same proxy: the Rust scrapers,
 * Node's page downloads and FlareSolverr, since a cf_clearance is bound to the
 * IP that earned it. See doc/cloudflare-clearance.md.
 */
export class ProviderProxyService extends Context.Service<ProviderProxyService>()(
	"api/ProviderProxyService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(FetchHttpClient.layer),
	);
}
