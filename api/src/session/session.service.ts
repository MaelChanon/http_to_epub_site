import * as crypto from "node:crypto";
import { Context, Data, Duration, Effect, Layer, Schema } from "effect";
import { appConfig } from "../config.js";
import { UserId } from "../domain/user/user.domain.js";
import { RedisClient, RedisClientLive } from "../redis.js";

export class InvalidSession extends Data.TaggedError("InvalidSession")<{
	readonly reason: string;
}> {
	get internalMessage() {
		return `Session token rejected: ${this.reason}`;
	}
}

export class MissingSession extends Data.TaggedError("MissingSession") {
	get internalMessage() {
		return "Authentication attempted without a session token";
	}
}

export class SessionStoreError extends Data.TaggedError("SessionStoreError")<{
	readonly message: string;
}> {
	get internalMessage() {
		return `Session store error: ${this.message}`;
	}
}

const sessionKey = (token: string) => `session:${token}`;
const userSessionsKey = (userId: string) => `user-sessions:${userId}`;

const decodeUserId = Schema.decodeUnknownEffect(UserId);

const make = Effect.gen(function* () {
	const config = yield* appConfig;
	const redis = yield* RedisClient;
	const ttl = Duration.seconds(config.sessionTtlSeconds);
	const ttlSeconds = Duration.toSeconds(ttl);

	/** Runs one Redis command, failing with a `SessionStoreError`. */
	const store = <A>(command: () => Promise<A>) =>
		Effect.tryPromise({
			try: command,
			catch: (e) =>
				new SessionStoreError({
					message: e instanceof Error ? e.message : String(e),
				}),
		});

	const createToken = Effect.fn("SessionService.createToken")(function* (
		userId: UserId,
	) {
		const token = crypto.randomBytes(32).toString("base64url");
		yield* store(() => redis.set(sessionKey(token), userId, "EX", ttlSeconds));
		yield* store(() => redis.sadd(userSessionsKey(userId), token));
		yield* store(() => redis.expire(userSessionsKey(userId), ttlSeconds));
		return token;
	});

	const verifyToken = Effect.fn("SessionService.verifyToken")(function* (
		token: string,
	) {
		const value = yield* store(() => redis.get(sessionKey(token)));
		if (!value) {
			return yield* new InvalidSession({ reason: "not found or expired" });
		}
		return yield* decodeUserId(value).pipe(
			Effect.mapError(
				() => new InvalidSession({ reason: "corrupted session value" }),
			),
		);
	});

	const revokeToken = Effect.fn("SessionService.revokeToken")(function* (
		token: string,
	) {
		const userId = yield* store(() => redis.get(sessionKey(token)));
		yield* store(() => redis.del(sessionKey(token)));
		if (userId) {
			yield* store(() => redis.srem(userSessionsKey(userId), token));
		}
	});

	const revokeAllForUser = Effect.fn("SessionService.revokeAllForUser")(
		function* (userId: UserId) {
			const tokens = yield* store(() =>
				redis.smembers(userSessionsKey(userId)),
			);
			if (tokens.length > 0) {
				yield* store(() => redis.del(...tokens.map(sessionKey)));
			}
			yield* store(() => redis.del(userSessionsKey(userId)));
		},
	);

	return { createToken, verifyToken, revokeToken, revokeAllForUser, ttl };
});

export class SessionService extends Context.Service<SessionService>()(
	"api/SessionService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(RedisClientLive),
	);
}
