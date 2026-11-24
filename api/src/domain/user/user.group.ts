import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";
import { Authentication } from "../../auth/auth.middleware.js";
import { HttpErrors } from "../../http/error.js";
import { NonEmptyTrimmedString } from "../schema.js";
import { Permission } from "./permission.js";
import {
	CreateInvitePayload,
	CreateUserPayload,
	LoginPayload,
	MagicLink,
	PasswordResetPreview,
	ResetPasswordPayload,
	User,
	UserId,
} from "./user.schema.js";

const UserIdParams = { id: UserId };
const TokenParams = { token: NonEmptyTrimmedString };

export class UsersApiGroup extends HttpApiGroup.make("users").add(
	HttpApiEndpoint.put("createUser", "/user", {
		payload: CreateUserPayload,
		success: User,
		error: HttpErrors,
	}),
	HttpApiEndpoint.get("listUsers", "/users", {
		success: Schema.Array(User),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.post("createInvite", "/users/invite", {
		payload: CreateInvitePayload,
		success: MagicLink,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.patch("updateUserPermissions", "/users/:id/permissions", {
		params: UserIdParams,
		payload: Schema.Struct({ permissions: Schema.Array(Permission) }),
		success: User,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.post("createPasswordReset", "/users/:id/password-reset", {
		params: UserIdParams,
		success: MagicLink,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.delete("deleteUser", "/users/:id", {
		params: UserIdParams,
		error: HttpErrors,
	}).middleware(Authentication),
) {}

export class AuthApiGroup extends HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.post("login", "/login", {
			payload: LoginPayload,
			success: User,
			error: HttpErrors,
		}),
		HttpApiEndpoint.post("logout", "/logout", { error: HttpErrors }),
		HttpApiEndpoint.get("me", "/me", {
			success: User,
			error: HttpErrors,
		}).middleware(Authentication),
		HttpApiEndpoint.get("getPasswordReset", "/password-reset/:token", {
			params: TokenParams,
			success: PasswordResetPreview,
			error: HttpErrors,
		}),
		HttpApiEndpoint.post("resetPassword", "/password-reset/:token", {
			params: TokenParams,
			payload: ResetPasswordPayload,
			error: HttpErrors,
		}),
	)
	.prefix("/auth") {}
