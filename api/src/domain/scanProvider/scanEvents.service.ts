import { Effect, Either, Schema, Stream } from "effect";
import { RedisClient, RedisClientLive } from "../../redis.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import { ScanEvent } from "./scanProvider.domain.js";

const channel = (mangaDbId: MangaDbId) => `scan-events:${mangaDbId}`;

export class ScanEventsService extends Effect.Service<ScanEventsService>()(
	"api/ScanEventsService",
	{
		effect: Effect.gen(function* () {
			const redis = yield* RedisClient;

			function publish(mangaDbId: MangaDbId, event: ScanEvent) {
				return Effect.tryPromise({
					try: () => redis.publish(channel(mangaDbId), JSON.stringify(event)),
					catch: (error) =>
						error instanceof Error ? error : new Error(String(error)),
				}).pipe(Effect.ignoreLogged);
			}

			function subscribe(mangaDbId: MangaDbId) {
				return Stream.asyncScoped<ScanEvent>((emit) =>
					Effect.acquireRelease(
						Effect.sync(() => redis.duplicate()),
						(subscriber) =>
							Effect.promise(() => subscriber.quit()).pipe(Effect.ignore),
					).pipe(
						Effect.tap((subscriber) =>
							Effect.gen(function* () {
								yield* Effect.tryPromise(() =>
									subscriber.subscribe(channel(mangaDbId)),
								).pipe(Effect.orDie);

								subscriber.on("message", (_channel, message) => {
									const parsed = Schema.decodeUnknownEither(
										Schema.parseJson(ScanEvent),
									)(message);

									if (Either.isRight(parsed)) {
										emit.single(parsed.right);
									}
								});
							}),
						),
					),
				);
			}

			return { publish, subscribe } as const;
		}),
		dependencies: [RedisClientLive],
	},
) {}
