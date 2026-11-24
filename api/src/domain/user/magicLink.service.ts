import * as crypto from "node:crypto";
import { Context, Data, Effect, Layer, Schema } from "effect";
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

const decodePermissions = Schema.decodeUnknownEffect(
	Schema.fromJsonString(Schema.Array(Permission)),
);
const decodeUserId = Schema.decodeUnknownEffect(UserId);

const make = Effect.gen(function* () {
	const config = yield* appConfig;
	const redis = yield* RedisClient;

	/** Runs one Redis command, failing with a `MagicLinkStoreError`. */
	const store = <A>(command: () => Promise<A>) =>
		Effect.tryPromise({
			try: command,
			catch: (e) =>
				new MagicLinkStoreError({
					message: e instanceof Error ? e.message : String(e),
				}),
		});

	const issue = Effect.fn("MagicLinkService.issue")(function* (
		key: (token: string) => string,
		value: string,
		ttl: number,
	) {
		const token = crypto.randomBytes(32).toString("base64url");
		yield* store(() => redis.set(key(token), value, "EX", ttl));
		return { token, expiresInSeconds: ttl };
	});

	const read = Effect.fn("MagicLinkService.read")(function* (
		key: (token: string) => string,
		token: string,
		consume: boolean,
	) {
		const raw = yield* store(() =>
			consume ? redis.getdel(key(token)) : redis.get(key(token)),
		);
		if (!raw) {
			return yield* new MagicLinkNotFound();
		}
		return raw;
	});

	const readInvite = (token: string, consume: boolean) =>
		read(inviteKey, token, consume).pipe(
			Effect.flatMap(decodePermissions),
			Effect.mapError((e) =>
				e._tag === "MagicLinkStoreError" ? e : new MagicLinkNotFound(),
			),
		);

	const readReset = (token: string, consume: boolean) =>
		read(resetKey, token, consume).pipe(
			Effect.flatMap(decodeUserId),
			Effect.mapError((e) =>
				e._tag === "MagicLinkStoreError" ? e : new MagicLinkNotFound(),
			),
		);

	const createInvite = (permissions: readonly Permission[]) =>
		issue(inviteKey, JSON.stringify(permissions), config.inviteTtlSeconds);

	const getOrCreateBootstrapInvite = Effect.fn(
		"MagicLinkService.getOrCreateBootstrapInvite",
	)(function* () {
		const known = yield* store(() => redis.get(BOOTSTRAP_POINTER_KEY));
		if (known) {
			const remaining = yield* store(() => redis.ttl(inviteKey(known)));
			if (remaining > 0) {
				return { token: known, expiresInSeconds: remaining };
			}
		}
		const link = yield* createInvite([]);
		yield* store(() =>
			redis.set(
				BOOTSTRAP_POINTER_KEY,
				link.token,
				"EX",
				config.inviteTtlSeconds,
			),
		);
		return link;
	});

	return {
		createInvite,
		getOrCreateBootstrapInvite,
		peekInvite: (token: string) => readInvite(token, false),
		consumeInvite: (token: string) => readInvite(token, true),
		createReset: (userId: UserId) =>
			issue(resetKey, userId, config.passwordResetTtlSeconds),
		peekReset: (token: string) => readReset(token, false),
		consumeReset: (token: string) => readReset(token, true),
	};
});

export class MagicLinkService extends Context.Service<MagicLinkService>()(
	"api/MagicLinkService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(RedisClientLive),
	);
}
