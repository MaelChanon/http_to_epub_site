import { Effect } from "effect";
import {
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "effect/http";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originOf(url: string) {
	try {
		return new URL(url).origin;
	} catch {
		return undefined;
	}
}

export const csrfProtection = (allowedOrigins: readonly string[]) =>
	HttpMiddleware.make((httpApp) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (!MUTATING_METHODS.has(request.method)) {
				return yield* httpApp;
			}

			const origin =
				request.headers.origin ?? originOf(request.headers.referer ?? "");
			if (origin === undefined || !allowedOrigins.includes(origin)) {
				return HttpServerResponse.empty({ status: 403 });
			}
			return yield* httpApp;
		}),
	);
