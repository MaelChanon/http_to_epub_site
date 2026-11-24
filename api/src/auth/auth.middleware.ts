import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/http-api";
import type { User } from "../domain/user/user.schema.js";
import { UnauthorizedError } from "../http/error.js";

export class CurrentUser extends Context.Service<CurrentUser, User>()(
	"CurrentUser",
) {}

export const SESSION_COOKIE_NAME = "session";

export const sessionCookie = HttpApiSecurity.apiKey({
	key: SESSION_COOKIE_NAME,
	in: "cookie",
});

export class Authentication extends HttpApiMiddleware.Service<
	Authentication,
	{ provides: CurrentUser }
>()("Authentication", {
	error: UnauthorizedError,
	security: { sessionCookie },
}) {}
