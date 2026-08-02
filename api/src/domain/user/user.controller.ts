import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { Effect, Option } from "effect";
import { CurrentUser, sessionCookie } from "../../auth/auth.middleware.js";
import { appConfig } from "../../config.js";
import { EncryptService } from "../../encrypt/encryptService.js";
import { Api } from "../../http/api.js";
import {
	BadRequestError,
	toHttpError,
	UnauthorizedError,
} from "../../http/error.js";
import { SessionService } from "../../session/session.service.js";
import { User } from "./user.schema.js";
import { UserService } from "./user.service.js";

export const UsersApiGroupLive = HttpApiBuilder.group(
	Api,
	"users",
	(handlers) =>
		Effect.gen(function* () {
			const userService = yield* UserService;
			const sessionService = yield* SessionService;
			const config = yield* appConfig;
			return handlers.handle("createUser", ({ payload }) =>
				Effect.gen(function* () {
					const existing = yield* Effect.option(
						userService.getUserByEmail(payload.email),
					);
					if (Option.isSome(existing)) {
						return yield* Effect.fail(
							new BadRequestError({ message: "User already exists" }),
						);
					}
					const user = yield* userService
						.createUser(payload)
						.pipe(Effect.catchAll(toHttpError));

					const token = yield* sessionService
						.createToken(user.id)
						.pipe(Effect.catchAll(toHttpError));
					yield* HttpApiBuilder.securitySetCookie(sessionCookie, token, {
						path: "/",
						sameSite: "lax",
						secure: config.cookieSecure,
						maxAge: sessionService.ttl,
					});

					return user;
				}),
			);
		}),
);

export const AuthApiGroupLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
	Effect.gen(function* () {
		const userService = yield* UserService;
		const encryptService = yield* EncryptService;
		const sessionService = yield* SessionService;
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
			.handle("me", () => CurrentUser);
	}),
);
