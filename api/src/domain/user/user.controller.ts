import { HttpApiBuilder, HttpServerRequest } from "@effect/platform";
import { Effect, Option } from "effect";
import { CurrentUser, sessionCookie } from "../../auth/auth.middleware.js";
import { AuthService } from "../../auth/auth.service.js";
import { appConfig } from "../../config.js";
import { EncryptService } from "../../encrypt/encryptService.js";
import { Api } from "../../http/api.js";
import {
	BadRequestError,
	ForbiddenError,
	toHttpError,
	UnauthorizedError,
} from "../../http/error.js";
import { SessionService } from "../../session/session.service.js";
import { requireAdmin } from "./permission.js";
import { User } from "./user.schema.js";
import { UserService } from "./user.service.js";

export const UsersApiGroupLive = HttpApiBuilder.group(
	Api,
	"users",
	(handlers) =>
		Effect.gen(function* () {
			const userService = yield* UserService;
			const sessionService = yield* SessionService;
			const authService = yield* AuthService;
			const config = yield* appConfig;
			return handlers
				.handle("createUser", ({ payload }) =>
					Effect.gen(function* () {
						const total = yield* userService
							.countUsers()
							.pipe(Effect.catchAll(toHttpError));

						if (total > 0) {
							const request = yield* HttpServerRequest.HttpServerRequest;
							const token = request.cookies.session;
							const requester = yield* authService
								.authenticate(token ?? "")
								.pipe(
									Effect.catchAll(() =>
										Effect.fail(
											new UnauthorizedError({
												message: "Authentication required",
											}),
										),
									),
								);
							if (!requester.isAdmin) {
								return yield* Effect.fail(
									new ForbiddenError({
										message: "Only an administrator can create users",
									}),
								);
							}
						}

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

						if (total === 0) {
							const token = yield* sessionService
								.createToken(user.id)
								.pipe(Effect.catchAll(toHttpError));
							yield* HttpApiBuilder.securitySetCookie(sessionCookie, token, {
								path: "/",
								sameSite: "lax",
								secure: config.cookieSecure,
								maxAge: sessionService.ttl,
							});
						}

						return user;
					}),
				)
				.handle("listUsers", () =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requireAdmin(user);
						return yield* userService
							.listUsers()
							.pipe(Effect.catchAll(toHttpError));
					}),
				)
				.handle("updateUserPermissions", ({ path, payload }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requireAdmin(user);
						const target = yield* userService
							.getUserById(path.id)
							.pipe(Effect.catchAll(toHttpError));
						if (target.isAdmin) {
							return yield* Effect.fail(
								new BadRequestError({
									message: "Cannot edit an administrator's permissions",
								}),
							);
						}
						return yield* userService
							.updateUserPermissions(path.id, payload.permissions)
							.pipe(Effect.catchAll(toHttpError));
					}),
				)
				.handle("deleteUser", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requireAdmin(user);
						const target = yield* userService
							.getUserById(path.id)
							.pipe(Effect.catchAll(toHttpError));
						if (target.isAdmin) {
							return yield* Effect.fail(
								new BadRequestError({
									message: "Cannot delete an administrator",
								}),
							);
						}
						yield* userService
							.deleteUser(path.id)
							.pipe(Effect.catchAll(toHttpError));
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
			.handle("me", () => CurrentUser);
	}),
);
