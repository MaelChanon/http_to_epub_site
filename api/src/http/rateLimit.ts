import {
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { Effect, Option } from "effect";
import { RedisClient } from "../redis.js";

interface RateLimitRule {
	readonly name: string;
	readonly methods: ReadonlySet<string>;
	readonly pattern: RegExp;
	readonly limit: number;
	readonly windowSeconds: number;
}

const RULES: readonly RateLimitRule[] = [
	{
		name: "login",
		methods: new Set(["POST"]),
		pattern: /^\/api\/auth\/login(?:\?.*)?$/,
		limit: 10,
		windowSeconds: 300,
	},
	{
		name: "create-user",
		methods: new Set(["PUT"]),
		pattern: /^\/api\/user(?:\?.*)?$/,
		limit: 5,
		windowSeconds: 3600,
	},
	{
		name: "password-reset",
		methods: new Set(["GET", "POST"]),
		pattern: /^\/api\/auth\/password-reset\/[^/?]+(?:\?.*)?$/,
		limit: 20,
		windowSeconds: 300,
	},
];

export const rateLimit = HttpMiddleware.make((httpApp) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rule = RULES.find(
			(rule) =>
				rule.methods.has(request.method) && rule.pattern.test(request.url),
		);

		if (!rule) {
			return yield* httpApp;
		}

		const redis = yield* RedisClient;
		const client = Option.getOrElse(request.remoteAddress, () => "unknown");
		const key = `ratelimit:${rule}:${client}`;

		const count = yield* Effect.tryPromise({
			try: async () => {
				const hits = await redis.incr(key);
				if (hits === 1) {
					await redis.expire(key, rule.windowSeconds);
				}
				return hits;
			},
			catch: (e) => e,
		}).pipe(
			Effect.catchAll((e) =>
				Effect.logError(
					`Rate limit counter unavailable for ${rule.name}: ${e instanceof Error ? e.message : String(e)}`,
				).pipe(Effect.as(0)),
			),
		);

		if (count <= rule.limit) {
			return yield* httpApp;
		}

		const retryAfter = yield* Effect.tryPromise({
			try: () => redis.ttl(key),
			catch: () => rule.windowSeconds,
		}).pipe(Effect.catchAll(() => Effect.succeed(rule.windowSeconds)));

		return yield* HttpServerResponse.empty({
			status: 429,
			headers: {
				"retry-after": String(retryAfter > 0 ? retryAfter : rule.windowSeconds),
			},
		});
	}),
);
