import { Schema } from "effect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Email = Schema.String.check(
	Schema.isPattern(EMAIL_PATTERN, { message: "Enter a valid email address" }),
);

export const Password = Schema.String.check(
	Schema.isMinLength(8, { message: "Password must be at least 8 characters" }),
);

export const requiredString = (message: string) =>
	Schema.String.check(Schema.isMinLength(1, { message }));
