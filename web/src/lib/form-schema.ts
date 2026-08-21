import { Schema } from "effect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Email = Schema.String.pipe(
	Schema.pattern(EMAIL_PATTERN, {
		message: () => "Enter a valid email address",
	}),
);

export const Password = Schema.String.pipe(
	Schema.minLength(8, {
		message: () => "Password must be at least 8 characters",
	}),
);

export const requiredString = (message: string) =>
	Schema.String.pipe(Schema.minLength(1, { message: () => message }));
