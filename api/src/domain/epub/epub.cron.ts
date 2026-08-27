import * as fs from "node:fs/promises";
import { Effect, Layer, Schedule } from "effect";
import { appConfig } from "../../config.js";
import { S3Service } from "../s3/s3.service.js";
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
	const s3 = yield* S3Service;
	const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
	const condemned = yield* epubRepo.failStale(cutoff);

	// These rows never reached their generation daemon's `cleanupTemp` — the
	// process died mid-flight — so their temp cover is still in the user
	// bucket with nothing left to reference it.
	const coverKeys = condemned.flatMap((row) =>
		row.coverKey ? [row.coverKey] : [],
	);
	if (coverKeys.length > 0) {
		yield* s3.user.deleteObjects(coverKeys);
		yield* Effect.logInfo(
			`epub reconciliation: deleted ${coverKeys.length} orphaned temp cover(s)`,
		);
	}
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
