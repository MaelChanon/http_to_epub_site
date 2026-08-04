import { Schema } from "effect";
import { Permission } from "./permission.js";

export { Permission } from "./permission.js";
export { User, UserId, UserWithPassword } from "./user.domain.js";

export class CreateUserPayload extends Schema.Class<CreateUserPayload>(
	"CreateUserPayload",
)({
	pseudo: Schema.NonEmptyTrimmedString,
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
	permissions: Schema.Array(Permission),
}) {}

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
}) {}
