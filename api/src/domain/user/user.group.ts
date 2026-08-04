import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../../auth/auth.middleware.js";
import { Permission } from "./permission.js";
import {
	CreateUserPayload,
	LoginPayload,
	User,
	UserId,
} from "./user.schema.js";

const UserIdPath = Schema.Struct({ id: UserId });

const UpdatePermissionsPayload = Schema.Struct({
	permissions: Schema.Array(Permission),
});

export class UsersApiGroup extends HttpApiGroup.make("users")
	.add(
		HttpApiEndpoint.put("createUser", "/user")
			.addSuccess(User)
			.setPayload(CreateUserPayload),
	)
	.add(
		HttpApiEndpoint.get("listUsers", "/users")
			.addSuccess(Schema.Array(User))
			.middleware(Authentication),
	)
	.add(
		HttpApiEndpoint.patch("updateUserPermissions", "/users/:id/permissions")
			.addSuccess(User)
			.middleware(Authentication)
			.setPath(UserIdPath)
			.setPayload(UpdatePermissionsPayload),
	)
	.add(
		HttpApiEndpoint.del("deleteUser", "/users/:id")
			.addSuccess(Schema.Void)
			.middleware(Authentication)
			.setPath(UserIdPath),
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
