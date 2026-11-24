import { Effect, Layer, Redacted } from "effect";
import { UnauthorizedError } from "../http/error.js";
import { AppLayer } from "../layer.js";
import { Authentication, CurrentUser } from "./auth.middleware.js";
import { AuthService } from "./auth.service.js";

export const AuthenticationLive = Layer.effect(
	Authentication,
	Effect.gen(function* () {
		const authService = yield* AuthService;
		return Authentication.of({
			sessionCookie: Effect.fn(function* (httpEffect, { credential }) {
				const user = yield* authService
					.authenticate(Redacted.value(credential))
					.pipe(
						Effect.mapError(
							() => new UnauthorizedError({ message: "Invalid session" }),
						),
					);
				return yield* Effect.provideService(httpEffect, CurrentUser, user);
			}),
		});
	}),
).pipe(Layer.provide(AppLayer));
