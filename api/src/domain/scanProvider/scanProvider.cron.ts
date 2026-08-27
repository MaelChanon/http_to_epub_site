import { Effect, Layer, Schedule } from "effect";
import { appConfig } from "../../config.js";
import { ProviderRepository } from "./provider.repository.js";
import { ProviderCatalogService } from "./providerCatalog.service.js";
import { ScanEventsService } from "./scanEvents.service.js";
import { PROVIDERS, ScanEvent } from "./scanProvider.domain.js";

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

// Links stuck in a transitioning status belong to sync daemons that died with
// their process — nothing will ever resolve them, and the UI would show a scan
// running forever. Their heartbeat stopped, so the sweep condemns them.
const staleLinkReconciliationLoop = Effect.gen(function* () {
	const providerRepo = yield* ProviderRepository;
	const scanEvents = yield* ScanEventsService;

	const condemned = yield* providerRepo.failStaleTransitions();
	if (condemned.length === 0) {
		return;
	}

	const providerNames = new Map(
		(yield* providerRepo.listProviders()).map((row) => [row.id, row.name]),
	);
	yield* Effect.forEach(condemned, (row) => {
		const provider = providerNames.get(row.providerId);
		return provider
			? scanEvents.publish(
					row.mangaId,
					new ScanEvent({ provider, status: "FAILED" }),
				)
			: Effect.void;
	});

	yield* Effect.logInfo(
		`scan reconciliation: failed ${condemned.length} stale manga provider link(s)`,
	);
}).pipe(
	Effect.catchAllCause((cause) =>
		Effect.logError(`scan reconciliation sweep failed: ${cause}`),
	),
	Effect.repeat(Schedule.fixed("5 minutes")),
);

export const ScanProviderCronLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		yield* Effect.forkScoped(providerCatalogCronLoop);
		yield* Effect.forkScoped(staleLinkReconciliationLoop);
	}),
);
