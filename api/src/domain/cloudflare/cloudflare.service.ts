import * as crypto from "node:crypto";
import {
	Context,
	Data,
	Effect,
	Layer,
	Option,
	Ref,
	Schedule,
	Schema,
} from "effect";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import { appConfig } from "../../config.js";
import { RedisClient, RedisClientLive } from "../../redis.js";
import {
	type Clearance,
	getProviderBaseUrl,
	type MangaProvider,
} from "../mangaFetcher/mangaFetcher.service.js";
import { ProviderProxyService } from "../providerProxy/providerProxy.service.js";

export class ClearanceUnavailable extends Data.TaggedError(
	"ClearanceUnavailable",
)<{
	readonly provider: MangaProvider;
	readonly message: string;
}> {
	get internalMessage() {
		return `Cloudflare clearance unavailable for ${this.provider}: ${this.message}`;
	}
}

/** Another worker holds the solve lock and hasn't published its result yet. */
class SolveInProgress extends Data.TaggedError("SolveInProgress") {}

const ClearanceJson = Schema.fromJsonString(
	Schema.Struct({ cookie: Schema.String, userAgent: Schema.String }),
);
const decodeClearance = Schema.decodeUnknownOption(ClearanceJson);
const encodeClearance = Schema.encodeSync(ClearanceJson);

const FlareSolverrResponse = Schema.Struct({
	status: Schema.String,
	message: Schema.optional(Schema.String),
	solution: Schema.optional(
		Schema.Struct({
			userAgent: Schema.String,
			cookies: Schema.Array(
				Schema.Struct({ name: Schema.String, value: Schema.String }),
			),
		}),
	),
});

const clearanceKey = (provider: MangaProvider) => `cf:clearance:${provider}`;
const lockKey = (provider: MangaProvider) => `cf:clearance:${provider}:lock`;

const SOLVE_MAX_TIMEOUT_MS = 60_000;
const SOLVE_HTTP_TIMEOUT = "90 seconds";
const LOCK_TTL_SECONDS = 120;
const WAIT_FOR_OTHER_SOLVER = {
	schedule: Schedule.spaced("2 seconds"),
	times: LOCK_TTL_SECONDS / 2,
};

const errorMessage = (e: unknown) =>
	e instanceof Error ? e.message : String(e);

const make = Effect.gen(function* () {
	const config = yield* appConfig;
	const redis = yield* RedisClient;
	const httpClient = yield* HttpClient.HttpClient;
	const providerProxy = yield* ProviderProxyService;

	const unavailable = (provider: MangaProvider) => (e: unknown) =>
		new ClearanceUnavailable({ provider, message: errorMessage(e) });

	/** Runs one Redis command, failing with a `ClearanceUnavailable`. */
	const store = <A>(provider: MangaProvider, command: () => Promise<A>) =>
		Effect.tryPromise({ try: command, catch: unavailable(provider) });

	/** The shared clearance, if one was solved and hasn't expired. */
	const cached = (provider: MangaProvider) =>
		store(provider, () => redis.get(clearanceKey(provider))).pipe(
			Effect.map((raw) =>
				raw === null ? Option.none<Clearance>() : decodeClearance(raw),
			),
			Effect.catch((e) =>
				Effect.logWarning(
					`cloudflare clearance cache read failed for ${provider}: ${e.message}`,
				).pipe(Effect.as(Option.none<Clearance>())),
			),
		);

	/** The shared clearance, unless it is the one that just got challenged. */
	const cachedOtherThan = (
		provider: MangaProvider,
		stale: Clearance | undefined,
	) =>
		cached(provider).pipe(
			Effect.map(Option.filter((c) => c.cookie !== stale?.cookie)),
		);

	const solve = Effect.fn("CloudflareService.solve")(function* (
		provider: MangaProvider,
	) {
		if (config.flaresolverrUrl === "") {
			return yield* new ClearanceUnavailable({
				provider,
				message: "no solver configured (FLARESOLVERR_URL is empty)",
			});
		}
		const url = getProviderBaseUrl(provider);
		const proxyUrl = providerProxy.proxyUrl(provider);
		yield* Effect.logInfo(`solving cloudflare challenge for ${url}`);

		const response = yield* HttpClientRequest.post(config.flaresolverrUrl).pipe(
			HttpClientRequest.bodyJson({
				cmd: "request.get",
				url,
				maxTimeout: SOLVE_MAX_TIMEOUT_MS,
				// Solve from the IP the clearance will be replayed from.
				...(proxyUrl && { proxy: { url: proxyUrl } }),
			}),
			Effect.flatMap(httpClient.execute),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(FlareSolverrResponse)),
			Effect.timeout(SOLVE_HTTP_TIMEOUT),
			Effect.mapError(unavailable(provider)),
		);

		if (response.status !== "ok" || !response.solution) {
			return yield* new ClearanceUnavailable({
				provider,
				message: `solver answered ${response.status}: ${response.message ?? ""}`,
			});
		}

		// The whole cookie set, not just cf_clearance: the origin sets others and
		// the scrapers replay the header as-is.
		const { cookies, userAgent } = response.solution;
		const clearance: Clearance = {
			cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
			userAgent,
		};
		yield* store(provider, () =>
			redis.set(
				clearanceKey(provider),
				encodeClearance(clearance),
				"EX",
				config.cfClearanceTtlSeconds,
			),
		);
		yield* Effect.logInfo(`cloudflare clearance obtained for ${url}`);
		return clearance;
	});

	const awaitOtherSolver = (
		provider: MangaProvider,
		stale: Clearance | undefined,
	) =>
		Effect.gen(function* () {
			const current = yield* cachedOtherThan(provider, stale);
			if (Option.isSome(current)) {
				return current.value;
			}
			const locked = yield* store(provider, () =>
				redis.exists(lockKey(provider)),
			);
			if (locked === 1) {
				return yield* new SolveInProgress();
			}
			return yield* new ClearanceUnavailable({
				provider,
				message: "the concurrent solve failed",
			});
		}).pipe(
			Effect.retry({
				...WAIT_FOR_OTHER_SOLVER,
				while: (e) => e._tag === "SolveInProgress",
			}),
			Effect.catchTag("SolveInProgress", () =>
				Effect.fail(
					new ClearanceUnavailable({
						provider,
						message: "timed out waiting for a concurrent solve",
					}),
				),
			),
		);

	const renew = Effect.fn("CloudflareService.renew")(function* (
		provider: MangaProvider,
		stale: Clearance | undefined,
	) {
		const current = yield* cachedOtherThan(provider, stale);
		if (Option.isSome(current)) {
			return current.value;
		}

		const owner = crypto.randomUUID();
		const acquired = yield* store(provider, () =>
			redis.set(lockKey(provider), owner, "EX", LOCK_TTL_SECONDS, "NX"),
		);
		if (acquired !== "OK") {
			return yield* awaitOtherSolver(provider, stale);
		}

		const releaseLock = store(provider, async () => {
			if ((await redis.get(lockKey(provider))) === owner) {
				await redis.del(lockKey(provider));
			}
		}).pipe(Effect.ignore);
		return yield* solve(provider).pipe(Effect.ensuring(releaseLock));
	});

	const session = Effect.fn("CloudflareService.session")(function* (
		provider: MangaProvider,
	) {
		const current = yield* Ref.make(
			Option.getOrUndefined(yield* cached(provider)),
		);

		/** Runs `operation`, renewing the clearance and retrying once if it is challenged. */
		const run = <A, E, R>(
			operation: (clearance: Clearance | undefined) => Effect.Effect<A, E, R>,
			isChallenge: (error: E) => boolean,
		): Effect.Effect<A, E | ClearanceUnavailable, R> =>
			Effect.gen(function* () {
				const clearance = yield* Ref.get(current);
				return yield* operation(clearance).pipe(
					Effect.catchIf(isChallenge, () =>
						Effect.logInfo(
							`cloudflare is challenging ${provider}, renewing the clearance`,
						).pipe(
							Effect.andThen(renew(provider, clearance)),
							Effect.tap((fresh) => Ref.set(current, fresh)),
							Effect.flatMap(operation),
						),
					),
				);
			});

		return { run };
	});

	return { session, renew };
});

/**
 * Cloudflare clearances for the providers behind Cloudflare, obtained from a
 * FlareSolverr instance and shared through Redis. See doc/cloudflare-clearance.md.
 */
export class CloudflareService extends Context.Service<CloudflareService>()(
	"api/CloudflareService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([
			RedisClientLive,
			FetchHttpClient.layer,
			ProviderProxyService.Default,
		]),
	);
}
