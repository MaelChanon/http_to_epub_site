import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Redis } from "ioredis";
import { appConfig } from "./config.js";

export class RedisClient extends Context.Tag("RedisClient")<
	RedisClient,
	Redis
>() {}

const redisClientEffect = Effect.gen(function* () {
	const config = yield* appConfig;
	return yield* Effect.acquireRelease(
		Effect.sync(() => new Redis(config.redisUrl)),
		(client) => Effect.sync(() => client.disconnect()),
	);
});

export const RedisClientLive = Layer.scoped(RedisClient, redisClientEffect);
