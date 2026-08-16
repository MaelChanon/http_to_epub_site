import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { Effect } from "effect";
import { appConfig } from "../config.js";
import { MagicLinkService } from "../domain/user/magicLink.service.js";
import { PasswordResetPreview, User } from "../domain/user/user.schema.js";
import { UserService } from "../domain/user/user.service.js";
import { EncryptService } from "../encrypt/encryptService.js";
import { Api } from "../http/api.js";
import { toHttpError, UnauthorizedError } from "../http/error.js";
import { SessionService } from "../session/session.service.js";
import { CurrentUser, sessionCookie } from "./auth.middleware.js";

export const AuthApiGroupLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
	Effect.gen(function* () {
		const userService = yield* UserService;
		const encryptService = yield* EncryptService;
		const sessionService = yield* SessionService;
		const magicLinkService = yield* MagicLinkService;
		const config = yield* appConfig;
		return handlers
			.handle("login", ({ payload }) =>
				Effect.gen(function* () {
					const user = yield* userService
						.getUserByEmailWithPassword(payload.email)
						.pipe(Effect.catchAll(toHttpError));

					const isValid = yield* encryptService
						.verify(payload.password, user.password)
						.pipe(Effect.catchAll(toHttpError));

					if (!isValid) {
						return yield* Effect.fail(
							new UnauthorizedError({ message: "Invalid credentials" }),
						);
					}

					const token = yield* sessionService
						.createToken(user.id)
						.pipe(Effect.catchAll(toHttpError));
					yield* HttpApiBuilder.securitySetCookie(sessionCookie, token, {
						path: "/",
						sameSite: "lax",
						secure: config.cookieSecure,
						maxAge: sessionService.ttl,
					});
					return new User({
						id: user.id,
						pseudo: user.pseudo,
						email: user.email,
						isAdmin: user.isAdmin,
						permissions: user.permissions,
					});
				}),
			)
			.handle("logout", () =>
				Effect.gen(function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					const token = request.cookies.session;
					if (token) {
						yield* sessionService
							.revokeToken(token)
							.pipe(Effect.catchAll(toHttpError));
					}
					yield* HttpApiBuilder.securitySetCookie(sessionCookie, "", {
						path: "/",
						sameSite: "lax",
						secure: config.cookieSecure,
						maxAge: 0,
					});
				}),
			)
			.handle("me", () => CurrentUser)
			.handle("getPasswordReset", ({ path }) =>
				Effect.gen(function* () {
					const userId = yield* magicLinkService
						.peekReset(path.token)
						.pipe(Effect.catchAll(toHttpError));
					const user = yield* userService
						.getUserById(userId)
						.pipe(Effect.catchAll(toHttpError));
					return new PasswordResetPreview({ pseudo: user.pseudo });
				}),
			)
			.handle("resetPassword", ({ path, payload }) =>
				Effect.gen(function* () {
					const userId = yield* magicLinkService
						.consumeReset(path.token)
						.pipe(Effect.catchAll(toHttpError));
					yield* userService
						.setPassword(userId, payload.password)
						.pipe(Effect.catchAll(toHttpError));
					yield* sessionService
						.revokeAllForUser(userId)
						.pipe(Effect.catchAll(toHttpError));
				}),
			);
	}),
);
