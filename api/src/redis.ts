import { Context, Effect, Layer } from "effect";
import { Redis } from "ioredis";
import { appConfig } from "./config.js";

export class RedisClient extends Context.Service<RedisClient, Redis>()(
	"RedisClient",
) {}

export const RedisClientLive = Layer.effect(
	RedisClient,
	Effect.gen(function* () {
		const config = yield* appConfig;
		return yield* Effect.acquireRelease(
			Effect.sync(() => new Redis(config.redisUrl)),
			(client) => Effect.sync(() => client.disconnect()),
		);
	}),
);
