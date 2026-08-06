import * as fs from "node:fs/promises";
import { Effect, Layer, Schedule } from "effect";
import { appConfig } from "../../config.js";
import { EpubRepository } from "./epub.repository.js";

const STALE_THRESHOLD_MINUTES = 30;

const purgeOutputDirOnBoot = Effect.gen(function* () {
	const config = yield* appConfig;
	yield* Effect.promise(() =>
		fs.rm(config.epubOutputDir, { recursive: true, force: true }),
	);
	yield* Effect.promise(() =>
		fs.mkdir(config.epubOutputDir, { recursive: true }),
	);
});

const reconciliationLoop = Effect.gen(function* () {
	const epubRepo = yield* EpubRepository;
	const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
	yield* epubRepo.failStale(cutoff);
}).pipe(
	Effect.catchAllCause((cause) =>
		Effect.logError(`epub reconciliation sweep failed: ${cause}`),
	),
	Effect.repeat(Schedule.fixed("5 minutes")),
);

export const EpubCronLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		yield* purgeOutputDirOnBoot.pipe(
			Effect.catchAllCause((cause) =>
				Effect.logError(`failed to purge epub output dir on boot: ${cause}`),
			),
		);
		yield* Effect.forkScoped(reconciliationLoop);
	}),
);
