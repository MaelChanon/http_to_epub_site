import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform";
import { Context } from "effect";
import { UnauthorizedError } from "../error.js";
import type { User } from "../user/user.schema.js";

export const CurrentUser = Context.GenericTag<User>("CurrentUser");

export const sessionCookie = HttpApiSecurity.apiKey({
	key: "session",
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
