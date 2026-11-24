import { Duration, Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { appConfig } from "../config.js";
import { MagicLinkService } from "../domain/user/magicLink.service.js";
import { PasswordResetPreview, User } from "../domain/user/user.schema.js";
import { UserService } from "../domain/user/user.service.js";
import {
	DUMMY_PASSWORD_HASH,
	EncryptService,
} from "../encrypt/encryptService.js";
import { Api } from "../http/api.js";
import { toHttpError, UnauthorizedError } from "../http/error.js";
import { SessionService } from "../session/session.service.js";
import {
	CurrentUser,
	SESSION_COOKIE_NAME,
	sessionCookie,
} from "./auth.middleware.js";

export const AuthApiGroupLive = HttpApiBuilder.group(
	Api,
	"auth",
	Effect.fn(function* (handlers) {
		const userService = yield* UserService;
		const encryptService = yield* EncryptService;
		const sessionService = yield* SessionService;
		const magicLinkService = yield* MagicLinkService;
		const config = yield* appConfig;

		const setSessionCookie = (token: string, maxAge = sessionService.ttl) =>
			HttpApiBuilder.securitySetCookie(sessionCookie, token, {
				path: "/",
				sameSite: "lax",
				secure: config.cookieSecure,
				maxAge,
			});

		return handlers.handleAll({
			login: Effect.fn(function* ({ payload }) {
				const user = yield* userService
					.getUserByEmailWithPassword(payload.email)
					.pipe(Effect.catchTag("UserNotFound", () => Effect.succeed(null)));

				// Compare against a dummy hash for unknown emails, so both cases take
				// the same time.
				const isValid = yield* encryptService.verify(
					payload.password,
					user?.password ?? DUMMY_PASSWORD_HASH,
				);
				if (user === null || !isValid) {
					return yield* new UnauthorizedError({
						message: "Invalid credentials",
					});
				}

				yield* setSessionCookie(yield* sessionService.createToken(user.id));
				return new User({
					id: user.id,
					pseudo: user.pseudo,
					email: user.email,
					isAdmin: user.isAdmin,
					permissions: user.permissions,
				});
			}, Effect.catch(toHttpError)),

			logout: Effect.fn(function* ({ request }) {
				const token = request.cookies[SESSION_COOKIE_NAME];
				if (token) {
					yield* sessionService.revokeToken(token);
				}
				yield* setSessionCookie("", Duration.zero);
			}, Effect.catch(toHttpError)),

			me: () => Effect.service(CurrentUser),

			getPasswordReset: Effect.fn(function* ({ params }) {
				const userId = yield* magicLinkService.peekReset(params.token);
				const user = yield* userService.getUserById(userId);
				return new PasswordResetPreview({ pseudo: user.pseudo });
			}, Effect.catch(toHttpError)),

			resetPassword: Effect.fn(function* ({ params, payload }) {
				const userId = yield* magicLinkService.consumeReset(params.token);
				yield* userService.setPassword(userId, payload.password);
				yield* sessionService.revokeAllForUser(userId);
			}, Effect.catch(toHttpError)),
		});
	}),
);
