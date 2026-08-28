import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform";
import { Context } from "effect";
import type { User } from "../domain/user/user.schema.js";
import { UnauthorizedError } from "../http/error.js";

export const CurrentUser = Context.GenericTag<User>("CurrentUser");

export const SESSION_COOKIE_NAME = "session";

export const sessionCookie = HttpApiSecurity.apiKey({
	key: SESSION_COOKIE_NAME,
	in: "cookie",
});

export class Authentication extends HttpApiMiddleware.Tag<Authentication>()(
	"Authentication",
	{
		provides: CurrentUser,
		failure: UnauthorizedError,
		security: { sessionCookie },
	},
) {}
