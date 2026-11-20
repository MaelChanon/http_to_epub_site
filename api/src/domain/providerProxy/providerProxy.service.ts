import { FetchHttpClient, HttpClient } from "@effect/platform";
// Subpath imports only: the package root also loads NodeClusterHttp, whose
// @effect/cluster peer dependency is not installed (crashes at startup).
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import Undici from "@effect/platform-node/Undici";
import { Effect } from "effect";
import { appConfig } from "../../config.js";
import type { MangaProvider } from "../mangaFetcher/mangaFetcher.service.js";

/**
 * Which providers must be reached through a proxy, because they ban the
 * server's own IP (anime-sama blocks hosting providers' ranges outright, a
 * Cloudflare block that no challenge solver gets past). Everything that talks
 * to such a provider must leave through the same proxy: the Rust scrapers,
 * Node's page downloads and FlareSolverr, since a cf_clearance is bound to the
 * IP that earned it. See doc/cloudflare-clearance.md.
 */
export class ProviderProxyService extends Effect.Service<ProviderProxyService>()(
	"api/ProviderProxyService",
	{
		scoped: Effect.gen(function* () {
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
				proxiedClients.set(provider, NodeHttpClient.makeUndici(agent));
				yield* Effect.logInfo(`provider ${provider} goes through a proxy`);
			}

			/** The proxy the provider's scraping must go through, if any. */
			function proxyUrl(provider: MangaProvider) {
				return proxyUrls.get(provider);
			}

			/** The HTTP client to download the provider's images with. */
			function httpClient(provider: MangaProvider) {
				return proxiedClients.get(provider) ?? directClient;
			}

			return { proxyUrl, httpClient } as const;
		}),
		dependencies: [FetchHttpClient.layer],
	},
) {}
