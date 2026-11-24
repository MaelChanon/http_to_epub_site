import { Effect, Option } from "effect";
import {
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "effect/http";
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
		const key = `ratelimit:${rule.name}:${client}`;

		const count = yield* Effect.tryPromise(async () => {
			const hits = await redis.incr(key);
			if (hits === 1) {
				await redis.expire(key, rule.windowSeconds);
			}
			return hits;
		}).pipe(
			Effect.catch((e) =>
				Effect.logError(
					`Rate limit counter unavailable for ${rule.name}`,
					e.cause,
				).pipe(Effect.as(0)),
			),
		);
		if (count <= rule.limit) {
			return yield* httpApp;
		}

		const ttl = yield* Effect.tryPromise(() => redis.ttl(key)).pipe(
			Effect.orElseSucceed(() => rule.windowSeconds),
		);
		return HttpServerResponse.empty({
			status: 429,
			headers: {
				"retry-after": String(ttl > 0 ? ttl : rule.windowSeconds),
			},
		});
	}),
);
