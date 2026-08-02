import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../../auth/auth.middleware.js";
import { CreateUserPayload, LoginPayload, User } from "./user.schema.js";

export class UsersApiGroup extends HttpApiGroup.make("users").add(
	HttpApiEndpoint.put("createUser", "/user")
		.addSuccess(User)
		.setPayload(CreateUserPayload),
) {}

export class AuthApiGroup extends HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.post("login", "/login")
			.addSuccess(User)
			.setPayload(LoginPayload),
	)
	.add(HttpApiEndpoint.post("logout", "/logout").addSuccess(Schema.Void))
	.add(
		HttpApiEndpoint.get("me", "/me")
			.addSuccess(User)
			.middleware(Authentication),
	)
	.prefix("/auth") {}
