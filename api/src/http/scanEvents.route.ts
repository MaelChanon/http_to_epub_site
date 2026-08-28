import {
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { Effect, Either, Schema, Stream } from "effect";
import { SESSION_COOKIE_NAME } from "../auth/auth.middleware.js";
import { AuthService } from "../auth/auth.service.js";
import { MangaService } from "../domain/manga/manga.service.js";
import { AniListIdFromString } from "../domain/mangaProvider/mangaProvider.domain.js";
import { ScanEventsService } from "../domain/scanProvider/scanEvents.service.js";

const ROUTE_PATTERN = /^\/api\/manga\/([^/?]+)\/events(?:\?.*)?$/;
const HEARTBEAT_INTERVAL = "20 seconds";

const encoder = new TextEncoder();

function sseFormat(payload: unknown) {
	return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export const scanEventsRoute = HttpMiddleware.make((httpApp) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const match =
			request.method === "GET" ? request.url.match(ROUTE_PATTERN) : null;

		if (!match) {
			return yield* httpApp;
		}

		const authService = yield* AuthService;
		const mangaService = yield* MangaService;
		const scanEvents = yield* ScanEventsService;

		const token = request.cookies[SESSION_COOKIE_NAME] ?? "";
		const authResult = yield* authService
			.authenticate(token)
			.pipe(Effect.either);
		if (Either.isLeft(authResult)) {
			return yield* HttpServerResponse.empty({ status: 401 });
		}
		const user = authResult.right;

		const mangaIdResult = Schema.decodeUnknownEither(AniListIdFromString)(
			match[1],
		);
		if (Either.isLeft(mangaIdResult)) {
			return yield* HttpServerResponse.empty({ status: 400 });
		}

		const mangaResult = yield* mangaService
			.getManga(mangaIdResult.right, user.id)
			.pipe(Effect.either);
		if (Either.isLeft(mangaResult)) {
			return yield* HttpServerResponse.empty({ status: 404 });
		}
		const manga = mangaResult.right;

		const heartbeat = Stream.repeatEffect(
			Effect.sleep(HEARTBEAT_INTERVAL).pipe(
				Effect.as(encoder.encode(": ping\n\n")),
			),
		);
		const events = Stream.map(scanEvents.subscribe(manga.id), sseFormat);

		return yield* HttpServerResponse.stream(Stream.merge(events, heartbeat), {
			contentType: "text/event-stream",
			headers: {
				"cache-control": "no-cache",
				connection: "keep-alive",
				"x-accel-buffering": "no",
			},
		});
	}),
);
