import { Effect, Schema, Stream } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { SESSION_COOKIE_NAME } from "../auth/auth.middleware.js";
import { AuthService } from "../auth/auth.service.js";
import { MangaService } from "../domain/manga/manga.service.js";
import { AniListIdFromString } from "../domain/mangaProvider/mangaProvider.domain.js";
import { ScanEventsService } from "../domain/scanProvider/scanEvents.service.js";

const HEARTBEAT_INTERVAL = "20 seconds";

const encoder = new TextEncoder();

const sseFormat = (payload: unknown) =>
	encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

const comment = (text: string) => encoder.encode(`: ${text}\n\n`);

/**
 * Server-Sent Events response: one `data:` frame per element, plus a heartbeat
 * comment to keep proxies from closing an idle connection. The first comment
 * is sent right away: the headers only leave with the first chunk, and the
 * browser's `EventSource` waits for them to fire `onopen`.
 */
function sseResponse(events: Stream.Stream<unknown>) {
	const heartbeat = Stream.fromEffectRepeat(
		Effect.sleep(HEARTBEAT_INTERVAL).pipe(Effect.as(comment("ping"))),
	);
	const frames = Stream.merge(Stream.map(events, sseFormat), heartbeat);
	return HttpServerResponse.stream(
		Stream.concat(Stream.make(comment("connected")), frames),
		{
			contentType: "text/event-stream",
			headers: {
				"cache-control": "no-cache",
				connection: "keep-alive",
				"x-accel-buffering": "no",
			},
		},
	);
}

const decodeMangaId = Schema.decodeUnknownEffect(AniListIdFromString);

/** Fails with an empty `status` response, that the route then answers with. */
const orRespond = (status: number) =>
	Effect.mapError(() => HttpServerResponse.empty({ status }));

/**
 * Server-Sent Events routes. They sit outside the `HttpApi` (an `EventSource`
 * is opened by hand in the browser), so they read the session cookie
 * themselves.
 */
export const EventsRoutesLive = HttpRouter.use(
	Effect.fn(function* (router) {
		const authService = yield* AuthService;
		const mangaService = yield* MangaService;
		const scanEvents = yield* ScanEventsService;

		const currentUser = Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const token = request.cookies[SESSION_COOKIE_NAME] ?? "";
			return yield* authService.authenticate(token).pipe(orRespond(401));
		});

		/** Scan status changes of one manga's providers. */
		yield* router.add(
			"GET",
			"/api/manga/:mangaId/events",
			Effect.gen(function* () {
				const user = yield* currentUser;
				const { mangaId } = yield* HttpRouter.params;
				const id = yield* decodeMangaId(mangaId).pipe(orRespond(400));
				const manga = yield* mangaService
					.getManga(id, user.id)
					.pipe(orRespond(404));
				return sseResponse(scanEvents.subscribe(manga.id));
			}).pipe(Effect.catch(Effect.succeed)),
		);
	}),
);
