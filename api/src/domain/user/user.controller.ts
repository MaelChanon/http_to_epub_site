import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
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
import type { UserId } from "./user.domain.js";
import { MagicLink } from "./user.schema.js";
import { UserService } from "./user.service.js";

export const UsersApiGroupLive = HttpApiBuilder.group(
	Api,
	"users",
	Effect.fn(function* (handlers) {
		const userService = yield* UserService;
		const sessionService = yield* SessionService;
		const magicLinkService = yield* MagicLinkService;
		const config = yield* appConfig;

		/** Loads the user an admin acts on; fails with `refusal` if it is an administrator. */
		const getEditableUser = Effect.fn(function* (id: UserId, refusal: string) {
			yield* requireAdmin(yield* CurrentUser);
			const target = yield* userService.getUserById(id);
			if (target.isAdmin) {
				return yield* new BadRequestError({ message: refusal });
			}
			return target;
		});

		return handlers.handleAll({
			createUser: Effect.fn(function* ({ payload }) {
				const total = yield* userService.countUsers();
				if (payload.token === undefined && total > 0) {
					return yield* new ForbiddenError({
						message:
							"Registration is closed — ask an administrator for an invite link",
					});
				}

				const permissions =
					payload.token === undefined
						? []
						: yield* magicLinkService.peekInvite(payload.token);

				const emailTaken = yield* userService
					.getUserByEmail(payload.email)
					.pipe(
						Effect.as(true),
						Effect.catchTag("UserNotFound", () => Effect.succeed(false)),
					);
				if (emailTaken) {
					return yield* new BadRequestError({ message: "User already exists" });
				}

				if (payload.token !== undefined) {
					yield* magicLinkService.consumeInvite(payload.token);
				}

				const user = yield* userService.createUser({
					pseudo: payload.pseudo,
					email: payload.email,
					password: payload.password,
					permissions,
					isAdmin: total === 0,
				});

				const token = yield* sessionService.createToken(user.id);
				yield* HttpApiBuilder.securitySetCookie(sessionCookie, token, {
					path: "/",
					sameSite: "lax",
					secure: config.cookieSecure,
					maxAge: sessionService.ttl,
				});
				return user;
			}, Effect.catch(toHttpError)),

			listUsers: Effect.fn(function* () {
				yield* requireAdmin(yield* CurrentUser);
				return yield* userService.listUsers();
			}, Effect.catch(toHttpError)),

			createInvite: Effect.fn(function* ({ payload }) {
				yield* requireAdmin(yield* CurrentUser);
				const link = yield* magicLinkService.createInvite(payload.permissions);
				return new MagicLink(link);
			}, Effect.catch(toHttpError)),

			createPasswordReset: Effect.fn(function* ({ params }) {
				const target = yield* getEditableUser(
					params.id,
					"Cannot reset an administrator's password",
				);
				const link = yield* magicLinkService.createReset(target.id);
				return new MagicLink(link);
			}, Effect.catch(toHttpError)),

			updateUserPermissions: Effect.fn(function* ({ params, payload }) {
				yield* getEditableUser(
					params.id,
					"Cannot edit an administrator's permissions",
				);
				return yield* userService.updateUserPermissions(
					params.id,
					payload.permissions,
				);
			}, Effect.catch(toHttpError)),

			deleteUser: Effect.fn(function* ({ params }) {
				yield* getEditableUser(params.id, "Cannot delete an administrator");
				yield* userService.deleteUser(params.id);
			}, Effect.catch(toHttpError)),
		});
	}),
);
