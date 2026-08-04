import { Effect, Layer, Redacted } from "effect";
import { UnauthorizedError } from "../http/error.js";
import { AppLayer } from "../layer.js";
import { Authentication } from "./auth.middleware.js";
import { AuthService } from "./auth.service.js";

export const AuthenticationLive = Layer.effect(
	Authentication,
	Effect.gen(function* () {
		const authService = yield* AuthService;
		return {
			sessionCookie: (token) =>
				authService
					.authenticate(Redacted.value(token))
					.pipe(
						Effect.mapError(
							() => new UnauthorizedError({ message: "Invalid session" }),
						),
					),
		};
	}),
).pipe(Layer.provide(AppLayer));
