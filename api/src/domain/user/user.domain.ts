import { Schema } from "effect";

export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export class User extends Schema.Class<User>("User")({
	id: UserId,
	pseudo: Schema.NonEmptyTrimmedString,
	email: Schema.NonEmptyTrimmedString,
	isAdmin: Schema.Boolean,
}) {}

export class UserWithPassword extends Schema.Class<UserWithPassword>(
	"UserWithPassword",
)({
	id: UserId,
	pseudo: Schema.NonEmptyTrimmedString,
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
	isAdmin: Schema.Boolean,
}) {}
