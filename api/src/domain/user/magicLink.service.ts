import * as crypto from "node:crypto";
import { Data, Effect, Schema } from "effect";
import { appConfig } from "../../config.js";
import { RedisClient, RedisClientLive } from "../../redis.js";
import { Permission } from "./permission.js";
import { UserId } from "./user.domain.js";

export class MagicLinkNotFound extends Data.TaggedError("MagicLinkNotFound") {
	get internalMessage() {
		return `Magic link rejected: no live token for the supplied value`;
	}
}

export class MagicLinkStoreError extends Data.TaggedError(
	"MagicLinkStoreError",
)<{
	readonly message: string;
}> {
	get internalMessage() {
		return `Magic link store error: ${this.message}`;
	}
}

const inviteKey = (token: string) => `magiclink:invite:${token}`;
const resetKey = (token: string) => `magiclink:reset:${token}`;
const BOOTSTRAP_POINTER_KEY = "magiclink:bootstrap";

const decodePermissions = Schema.decodeUnknown(
	Schema.parseJson(Schema.Array(Permission)),
);
const decodeUserId = Schema.decodeUnknown(UserId);

const toStoreError = (e: unknown) =>
	new MagicLinkStoreError({
		message: e instanceof Error ? e.message : String(e),
	});

export class MagicLinkService extends Effect.Service<MagicLinkService>()(
	"api/MagicLinkService",
	{
		effect: Effect.gen(function* () {
			const config = yield* appConfig;
			const redis = yield* RedisClient;

			function issue(
				key: (token: string) => string,
				value: string,
				ttl: number,
			) {
				return Effect.gen(function* () {
					const token = crypto.randomBytes(32).toString("base64url");
					yield* Effect.tryPromise({
						try: () => redis.set(key(token), value, "EX", ttl),
						catch: toStoreError,
					});
					return { token, expiresInSeconds: ttl };
				});
			}

			function read(
				key: (token: string) => string,
				token: string,
				consume: boolean,
			) {
				return Effect.gen(function* () {
					const raw = yield* Effect.tryPromise({
						try: () =>
							consume ? redis.getdel(key(token)) : redis.get(key(token)),
						catch: toStoreError,
					});
					if (!raw) {
						return yield* Effect.fail(new MagicLinkNotFound());
					}
					return raw;
				});
			}

			function createInvite(permissions: readonly Permission[]) {
				return issue(
					inviteKey,
					JSON.stringify(permissions),
					config.inviteTtlSeconds,
				);
			}

			function readInvite(token: string, consume: boolean) {
				return read(inviteKey, token, consume).pipe(
					Effect.flatMap((raw) =>
						decodePermissions(raw).pipe(
							Effect.mapError(() => new MagicLinkNotFound()),
						),
					),
				);
			}

			function getOrCreateBootstrapInvite() {
				return Effect.gen(function* () {
					const known = yield* Effect.tryPromise({
						try: () => redis.get(BOOTSTRAP_POINTER_KEY),
						catch: toStoreError,
					});
					if (known) {
						const remaining = yield* Effect.tryPromise({
							try: () => redis.ttl(inviteKey(known)),
							catch: toStoreError,
						});
						if (remaining > 0) {
							return { token: known, expiresInSeconds: remaining };
						}
					}
					const link = yield* createInvite([]);
					yield* Effect.tryPromise({
						try: () =>
							redis.set(
								BOOTSTRAP_POINTER_KEY,
								link.token,
								"EX",
								config.inviteTtlSeconds,
							),
						catch: toStoreError,
					});
					return link;
				});
			}

			function createReset(userId: UserId) {
				return issue(resetKey, userId, config.passwordResetTtlSeconds);
			}

			function readReset(token: string, consume: boolean) {
				return read(resetKey, token, consume).pipe(
					Effect.flatMap((raw) =>
						decodeUserId(raw).pipe(
							Effect.mapError(() => new MagicLinkNotFound()),
						),
					),
				);
			}

			return {
				createInvite,
				getOrCreateBootstrapInvite,
				peekInvite: (token: string) => readInvite(token, false),
				consumeInvite: (token: string) => readInvite(token, true),
				createReset,
				peekReset: (token: string) => readReset(token, false),
				consumeReset: (token: string) => readReset(token, true),
			} as const;
		}),
		dependencies: [RedisClientLive],
	},
) {}
