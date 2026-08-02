import { Schema } from "effect";

export { User, UserId, UserWithPassword } from "./user.domain.js";

export class CreateUserPayload extends Schema.Class<CreateUserPayload>(
	"CreateUserPayload",
)({
	pseudo: Schema.NonEmptyTrimmedString,
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
}) {}

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
}) {}
