import { HttpApiBuilder } from "@effect/platform";
import { Effect, Option } from "effect";
import { CurrentUser, sessionCookie } from "../../auth/auth.middleware.js";
import { appConfig } from "../../config.js";
import { Api } from "../../http/api.js";
import {
	BadRequestError,
	ForbiddenError,
	toHttpError,
} from "../../http/error.js";
import { SessionService } from "../../session/session.service.js";
import { MagicLinkService } from "./magicLink.service.js";
import { requireAdmin } from "./permission.js";
import { MagicLink } from "./user.schema.js";
import { UserService } from "./user.service.js";

export const UsersApiGroupLive = HttpApiBuilder.group(
	Api,
	"users",
	(handlers) =>
		Effect.gen(function* () {
			const userService = yield* UserService;
			const sessionService = yield* SessionService;
			const magicLinkService = yield* MagicLinkService;
			const config = yield* appConfig;
			return handlers
				.handle("createUser", ({ payload }) =>
					Effect.gen(function* () {
						const total = yield* userService
							.countUsers()
							.pipe(Effect.catchAll(toHttpError));

						if (payload.token === undefined && total > 0) {
							return yield* Effect.fail(
								new ForbiddenError({
									message:
										"Registration is closed — ask an administrator for an invite link",
								}),
							);
						}

						const permissions =
							payload.token === undefined
								? []
								: yield* magicLinkService
										.peekInvite(payload.token)
										.pipe(Effect.catchAll(toHttpError));

						const existing = yield* Effect.option(
							userService.getUserByEmail(payload.email),
						);
						if (Option.isSome(existing)) {
							return yield* Effect.fail(
								new BadRequestError({ message: "User already exists" }),
							);
						}

						if (payload.token !== undefined) {
							yield* magicLinkService
								.consumeInvite(payload.token)
								.pipe(Effect.catchAll(toHttpError));
						}

						const user = yield* userService
							.createUser({
								pseudo: payload.pseudo,
								email: payload.email,
								password: payload.password,
								permissions,
								isAdmin: total === 0,
							})
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
				.handle("createInvite", ({ payload }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requireAdmin(user);
						const link = yield* magicLinkService
							.createInvite(payload.permissions)
							.pipe(Effect.catchAll(toHttpError));
						return new MagicLink(link);
					}),
				)
				.handle("createPasswordReset", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requireAdmin(user);
						const target = yield* userService
							.getUserById(path.id)
							.pipe(Effect.catchAll(toHttpError));
						if (target.isAdmin) {
							return yield* Effect.fail(
								new BadRequestError({
									message: "Cannot reset an administrator's password",
								}),
							);
						}
						const link = yield* magicLinkService
							.createReset(target.id)
							.pipe(Effect.catchAll(toHttpError));
						return new MagicLink(link);
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
