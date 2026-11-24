import { Context, Effect, Layer, Queue, Result, Schema, Stream } from "effect";
import { RedisClient, RedisClientLive } from "../../redis.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import { ScanEvent } from "./scanProvider.domain.js";

const channel = (mangaDbId: MangaDbId) => `scan-events:${mangaDbId}`;

const decodeScanEvent = Schema.decodeUnknownResult(
	Schema.fromJsonString(ScanEvent),
);

type Listener = (event: ScanEvent) => void;

const make = Effect.gen(function* () {
	const redis = yield* RedisClient;

	const subscriber = yield* Effect.acquireRelease(
		Effect.sync(() => redis.duplicate()),
		(client) => Effect.promise(() => client.quit()).pipe(Effect.ignore),
	);

	const listeners = new Map<string, Set<Listener>>();

	subscriber.on("message", (channelName, message) => {
		const parsed = decodeScanEvent(message);
		if (Result.isFailure(parsed)) {
			return;
		}
		for (const listener of listeners.get(channelName) ?? []) {
			listener(parsed.success);
		}
	});

	const addListener = (channelName: string, listener: Listener) =>
		Effect.suspend(() => {
			const existing = listeners.get(channelName);
			if (existing) {
				existing.add(listener);
				return Effect.void;
			}
			listeners.set(channelName, new Set([listener]));
			return Effect.promise(() => subscriber.subscribe(channelName));
		});

	const removeListener = (channelName: string, listener: Listener) =>
		Effect.suspend(() => {
			const existing = listeners.get(channelName);
			existing?.delete(listener);
			if (!existing || existing.size > 0) {
				return Effect.void;
			}
			listeners.delete(channelName);
			return Effect.promise(() => subscriber.unsubscribe(channelName)).pipe(
				Effect.ignore,
			);
		});

	const publish = (mangaDbId: MangaDbId, event: ScanEvent) =>
		Effect.tryPromise(() =>
			redis.publish(channel(mangaDbId), JSON.stringify(event)),
		).pipe(Effect.ignore({ log: true }));

	const subscribe = (mangaDbId: MangaDbId) =>
		Stream.callback<ScanEvent>((queue) => {
			const listener: Listener = (event) => {
				Queue.offerUnsafe(queue, event);
			};
			return Effect.acquireRelease(
				addListener(channel(mangaDbId), listener),
				() => removeListener(channel(mangaDbId), listener),
			);
		});

	return { publish, subscribe };
});

export class ScanEventsService extends Context.Service<ScanEventsService>()(
	"api/ScanEventsService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(RedisClientLive),
	);
}
