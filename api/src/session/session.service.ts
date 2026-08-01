import * as crypto from "node:crypto";
import { Data, Duration, Effect, Schema } from "effect";
import { appConfig } from "../config.js";
import { RedisClient, RedisClientLive } from "../redis.js";
import { UserId } from "../user/user.domain.js";

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
					yield* Effect.tryPromise({
						try: () =>
							redis.set(
								sessionKey(token),
								userId,
								"EX",
								Duration.toSeconds(ttl),
							),
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
				return Effect.tryPromise({
					try: () => redis.del(sessionKey(token)),
					catch: toSessionStoreError,
				}).pipe(Effect.asVoid);
			}

			return { createToken, verifyToken, revokeToken, ttl } as const;
		}),
		dependencies: [RedisClientLive],
	},
) {}
