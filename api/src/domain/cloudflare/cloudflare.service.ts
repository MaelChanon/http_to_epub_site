import * as crypto from "node:crypto";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Data, Effect, Option, Ref, Schedule, Schema } from "effect";
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

const ClearanceJson = Schema.parseJson(
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
const WAIT_FOR_OTHER_SOLVER = Schedule.spaced("2 seconds").pipe(
	Schedule.intersect(Schedule.recurs(LOCK_TTL_SECONDS / 2)),
);

const errorMessage = (e: unknown) =>
	e instanceof Error ? e.message : String(e);

/**
 * Cloudflare clearances for the providers behind Cloudflare, obtained from a
 * FlareSolverr instance and shared through Redis. See doc/cloudflare-clearance.md.
 */
export class CloudflareService extends Effect.Service<CloudflareService>()(
	"api/CloudflareService",
	{
		effect: Effect.gen(function* () {
			const config = yield* appConfig;
			const redis = yield* RedisClient;
			const httpClient = yield* HttpClient.HttpClient;
			const providerProxy = yield* ProviderProxyService;

			const unavailable = (provider: MangaProvider) => (e: unknown) =>
				new ClearanceUnavailable({ provider, message: errorMessage(e) });

			/** The shared clearance, if one was solved and hasn't expired. */
			function cached(provider: MangaProvider) {
				return Effect.tryPromise(() => redis.get(clearanceKey(provider))).pipe(
					Effect.map((raw) =>
						raw === null ? Option.none() : decodeClearance(raw),
					),
					Effect.catchAll((e) =>
						Effect.logWarning(
							`cloudflare clearance cache read failed for ${provider}: ${errorMessage(e)}`,
						).pipe(Effect.as(Option.none<Clearance>())),
					),
				);
			}

			function solve(provider: MangaProvider) {
				return Effect.gen(function* () {
					if (config.flaresolverrUrl === "") {
						return yield* Effect.fail(
							new ClearanceUnavailable({
								provider,
								message: "no solver configured (FLARESOLVERR_URL is empty)",
							}),
						);
					}
					const url = getProviderBaseUrl(provider);
					const proxyUrl = providerProxy.proxyUrl(provider);
					yield* Effect.logInfo(`solving cloudflare challenge for ${url}`);

					const response = yield* HttpClientRequest.post(
						config.flaresolverrUrl,
					).pipe(
						HttpClientRequest.bodyJson({
							cmd: "request.get",
							url,
							maxTimeout: SOLVE_MAX_TIMEOUT_MS,
							// Solve from the IP the clearance will be replayed from.
							...(proxyUrl && { proxy: { url: proxyUrl } }),
						}),
						Effect.flatMap(httpClient.execute),
						Effect.flatMap(
							HttpClientResponse.schemaBodyJson(FlareSolverrResponse),
						),
						Effect.timeout(SOLVE_HTTP_TIMEOUT),
						Effect.mapError(unavailable(provider)),
					);

					if (response.status !== "ok" || !response.solution) {
						return yield* Effect.fail(
							new ClearanceUnavailable({
								provider,
								message: `solver answered ${response.status}: ${response.message ?? ""}`,
							}),
						);
					}

					// The whole cookie set, not just cf_clearance: the origin sets
					// others and the crate replays the header as-is.
					const { cookies, userAgent } = response.solution;
					const clearance: Clearance = {
						cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
						userAgent,
					};
					yield* Effect.tryPromise(() =>
						redis.set(
							clearanceKey(provider),
							encodeClearance(clearance),
							"EX",
							config.cfClearanceTtlSeconds,
						),
					).pipe(Effect.mapError(unavailable(provider)));
					yield* Effect.logInfo(`cloudflare clearance obtained for ${url}`);
					return clearance;
				});
			}

			function awaitOtherSolver(
				provider: MangaProvider,
				stale: Clearance | undefined,
			) {
				return Effect.gen(function* () {
					const current = yield* cached(provider);
					if (
						Option.isSome(current) &&
						current.value.cookie !== stale?.cookie
					) {
						return current.value;
					}
					const locked = yield* Effect.tryPromise(() =>
						redis.exists(lockKey(provider)),
					).pipe(Effect.mapError(unavailable(provider)));
					return yield* locked === 1
						? Effect.fail(new SolveInProgress())
						: Effect.fail(
								new ClearanceUnavailable({
									provider,
									message: "the concurrent solve failed",
								}),
							);
				}).pipe(
					Effect.retry({
						schedule: WAIT_FOR_OTHER_SOLVER,
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
			}

			function renew(provider: MangaProvider, stale: Clearance | undefined) {
				return Effect.gen(function* () {
					const current = yield* cached(provider);
					if (
						Option.isSome(current) &&
						current.value.cookie !== stale?.cookie
					) {
						return current.value;
					}

					const owner = crypto.randomUUID();
					const acquired = yield* Effect.tryPromise(() =>
						redis.set(lockKey(provider), owner, "EX", LOCK_TTL_SECONDS, "NX"),
					).pipe(Effect.mapError(unavailable(provider)));
					if (acquired !== "OK") {
						return yield* awaitOtherSolver(provider, stale);
					}

					return yield* solve(provider).pipe(
						Effect.ensuring(
							Effect.tryPromise(async () => {
								if ((await redis.get(lockKey(provider))) === owner) {
									await redis.del(lockKey(provider));
								}
							}).pipe(Effect.ignore),
						),
					);
				});
			}

			function session(provider: MangaProvider) {
				return Effect.gen(function* () {
					const current = yield* Ref.make(
						Option.getOrUndefined(yield* cached(provider)),
					);

					function run<A, E, R>(
						operation: (
							clearance: Clearance | undefined,
						) => Effect.Effect<A, E, R>,
						isChallenge: (error: E) => boolean,
					): Effect.Effect<A, E | ClearanceUnavailable, R> {
						return Effect.gen(function* () {
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
					}

					return { run } as const;
				});
			}

			return { session, renew } as const;
		}),
		dependencies: [
			RedisClientLive,
			FetchHttpClient.layer,
			ProviderProxyService.Default,
		],
	},
) {}
