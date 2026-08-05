import { Effect, Layer, Schedule } from "effect";
import { appConfig } from "../../config.js";
import { ProviderCatalogService } from "./providerCatalog.service.js";
import { PROVIDERS } from "./scanProvider.domain.js";

const providerCatalogCronLoop = Effect.gen(function* () {
	const providerCatalog = yield* ProviderCatalogService;
	const provider = (yield* appConfig).disableAnilistFetching ? [] : PROVIDERS;
	yield* Effect.logInfo("cron tick start");
	yield* Effect.forEach(
		provider,
		(provider) =>
			providerCatalog.refreshCatalog(provider).pipe(
				Effect.retry(
					Schedule.exponential("1 seconds").pipe(
						Schedule.compose(Schedule.recurs(3)),
					),
				),
				Effect.tap(() =>
					Effect.logInfo(`provider catalog refreshed: ${provider}`),
				),
				Effect.catchAll((err) =>
					Effect.logError(
						`provider catalog refresh failed for ${provider}: ${err}`,
					),
				),
			),
		{ concurrency: 1 },
	);
}).pipe(Effect.repeat(Schedule.cron("0 3 * * *")));

export const ScanProviderCronLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		yield* Effect.forkScoped(providerCatalogCronLoop);
	}),
);
