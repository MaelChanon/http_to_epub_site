import { Effect, Either, Schema, Stream } from "effect";
import { RedisClient, RedisClientLive } from "../../redis.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import { ScanEvent } from "./scanProvider.domain.js";

const channel = (mangaDbId: MangaDbId) => `scan-events:${mangaDbId}`;

type Listener = (event: ScanEvent) => void;

export class ScanEventsService extends Effect.Service<ScanEventsService>()(
	"api/ScanEventsService",
	{
		scoped: Effect.gen(function* () {
			const redis = yield* RedisClient;

			const subscriber = yield* Effect.acquireRelease(
				Effect.sync(() => redis.duplicate()),
				(client) => Effect.promise(() => client.quit()).pipe(Effect.ignore),
			);

			const listeners = new Map<string, Set<Listener>>();

			subscriber.on("message", (channelName, message) => {
				const channelListeners = listeners.get(channelName);
				if (!channelListeners) {
					return;
				}

				const parsed = Schema.decodeUnknownEither(Schema.parseJson(ScanEvent))(
					message,
				);

				if (Either.isRight(parsed)) {
					for (const listener of channelListeners) {
						listener(parsed.right);
					}
				}
			});

			function addListener(channelName: string, listener: Listener) {
				return Effect.suspend(() => {
					const existing = listeners.get(channelName);
					if (existing) {
						existing.add(listener);
						return Effect.void;
					}

					listeners.set(channelName, new Set([listener]));
					return Effect.tryPromise(() =>
						subscriber.subscribe(channelName),
					).pipe(Effect.orDie);
				});
			}

			function removeListener(channelName: string, listener: Listener) {
				return Effect.suspend(() => {
					const existing = listeners.get(channelName);
					if (!existing) {
						return Effect.void;
					}

					existing.delete(listener);
					if (existing.size > 0) {
						return Effect.void;
					}

					listeners.delete(channelName);
					return Effect.promise(() => subscriber.unsubscribe(channelName)).pipe(
						Effect.ignore,
					);
				});
			}

			function publish(mangaDbId: MangaDbId, event: ScanEvent) {
				return Effect.tryPromise({
					try: () => redis.publish(channel(mangaDbId), JSON.stringify(event)),
					catch: (error) =>
						error instanceof Error ? error : new Error(String(error)),
				}).pipe(Effect.ignoreLogged);
			}

			function subscribe(mangaDbId: MangaDbId) {
				return Stream.asyncScoped<ScanEvent>((emit) => {
					const channelName = channel(mangaDbId);
					const listener: Listener = (event) => {
						emit.single(event);
					};

					return Effect.acquireRelease(addListener(channelName, listener), () =>
						removeListener(channelName, listener),
					);
				});
			}

			return { publish, subscribe } as const;
		}),
		dependencies: [RedisClientLive],
	},
) {}
