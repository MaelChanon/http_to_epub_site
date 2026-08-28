import { Schema } from "effect";
import { Permission } from "./permission.js";

export { Permission } from "./permission.js";
export { User, UserId, UserWithPassword } from "./user.domain.js";

const MIN_PASSWORD_LENGTH = 8;

const Password = Schema.String.pipe(
	Schema.minLength(MIN_PASSWORD_LENGTH, {
		message: () =>
			`Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
	}),
);

export class CreateUserPayload extends Schema.Class<CreateUserPayload>(
	"CreateUserPayload",
)({
	pseudo: Schema.NonEmptyTrimmedString,
	email: Schema.NonEmptyTrimmedString,
	password: Password,
	token: Schema.optional(Schema.NonEmptyTrimmedString),
}) {}

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
	email: Schema.NonEmptyTrimmedString,
	password: Schema.NonEmptyTrimmedString,
}) {}

export class CreateInvitePayload extends Schema.Class<CreateInvitePayload>(
	"CreateInvitePayload",
)({
	permissions: Schema.Array(Permission),
}) {}

export class MagicLink extends Schema.Class<MagicLink>("MagicLink")({
	token: Schema.NonEmptyTrimmedString,
	expiresInSeconds: Schema.Number,
}) {}

export class PasswordResetPreview extends Schema.Class<PasswordResetPreview>(
	"PasswordResetPreview",
)({
	pseudo: Schema.NonEmptyTrimmedString,
}) {}

export class ResetPasswordPayload extends Schema.Class<ResetPasswordPayload>(
	"ResetPasswordPayload",
)({
	password: Password,
}) {}
