import * as crypto from "node:crypto";
import { Data, Duration, Effect, Schema } from "effect";
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

const toSessionStoreError = (e: unknown) =>
	new SessionStoreError({
		message: e instanceof Error ? e.message : String(e),
	});

export class SessionService extends Effect.Service<SessionService>()(
	"api/SessionService",
	{
		effect: Effect.gen(function* () {
			const config = yield* appConfig;
			const redis = yield* RedisClient;
			const ttl = Duration.seconds(config.sessionTtlSeconds);

			function createToken(userId: UserId) {
				return Effect.gen(function* () {
					const token = crypto.randomBytes(32).toString("base64url");
					const seconds = Duration.toSeconds(ttl);
					yield* Effect.tryPromise({
						try: () => redis.set(sessionKey(token), userId, "EX", seconds),
						catch: toSessionStoreError,
					});
					yield* Effect.tryPromise({
						try: () => redis.sadd(userSessionsKey(userId), token),
						catch: toSessionStoreError,
					});
					yield* Effect.tryPromise({
						try: () => redis.expire(userSessionsKey(userId), seconds),
						catch: toSessionStoreError,
					});
					return token;
				});
			}

			function verifyToken(token: string) {
				return Effect.gen(function* () {
					const value = yield* Effect.tryPromise({
						try: () => redis.get(sessionKey(token)),
						catch: toSessionStoreError,
					});
					if (!value) {
						return yield* Effect.fail(
							new InvalidSession({ reason: "not found or expired" }),
						);
					}
					return yield* Schema.decodeUnknown(UserId)(value).pipe(
						Effect.mapError(
							() => new InvalidSession({ reason: "corrupted session value" }),
						),
					);
				});
			}

			function revokeToken(token: string) {
				return Effect.gen(function* () {
					const userId = yield* Effect.tryPromise({
						try: () => redis.get(sessionKey(token)),
						catch: toSessionStoreError,
					});
					yield* Effect.tryPromise({
						try: () => redis.del(sessionKey(token)),
						catch: toSessionStoreError,
					});
					if (userId) {
						yield* Effect.tryPromise({
							try: () => redis.srem(userSessionsKey(userId), token),
							catch: toSessionStoreError,
						});
					}
				});
			}

			function revokeAllForUser(userId: UserId) {
				return Effect.gen(function* () {
					const tokens = yield* Effect.tryPromise({
						try: () => redis.smembers(userSessionsKey(userId)),
						catch: toSessionStoreError,
					});
					if (tokens.length > 0) {
						yield* Effect.tryPromise({
							try: () => redis.del(...tokens.map(sessionKey)),
							catch: toSessionStoreError,
						});
					}
					yield* Effect.tryPromise({
						try: () => redis.del(userSessionsKey(userId)),
						catch: toSessionStoreError,
					});
				});
			}

			return {
				createToken,
				verifyToken,
				revokeToken,
				revokeAllForUser,
				ttl,
			} as const;
		}),
		dependencies: [RedisClientLive],
	},
) {}
