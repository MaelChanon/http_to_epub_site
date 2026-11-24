import { Schema } from "effect";
import { NonEmptyTrimmedString, UUID } from "../schema.js";
import { Permission } from "./permission.js";

export const UserId = UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export class User extends Schema.Class<User>("User")({
	id: UserId,
	pseudo: NonEmptyTrimmedString,
	email: NonEmptyTrimmedString,
	isAdmin: Schema.Boolean,
	permissions: Schema.Array(Permission),
}) {}

export class UserWithPassword extends Schema.Class<UserWithPassword>(
	"UserWithPassword",
)({
	...User.fields,
	password: NonEmptyTrimmedString,
}) {}
