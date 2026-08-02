import { Effect, Match, Schema } from "effect";
import type { DomainError } from "./appError.js";

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
	"NotFoundError",
	{ message: Schema.String },
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
	"ForbiddenError",
	{ message: Schema.String },
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
	"UnauthorizedError",
	{ message: Schema.String },
) {}

export class BadRequestError extends Schema.TaggedError<BadRequestError>()(
	"BadRequestError",
	{ message: Schema.String },
) {}

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
	"InternalServerError",
	{ message: Schema.String },
) {}

export type HttpError =
	| NotFoundError
	| BadRequestError
	| InternalServerError
	| ForbiddenError
	| UnauthorizedError;

export const toHttpError = (
	err: DomainError,
): Effect.Effect<never, HttpError> =>
	Effect.logError(err.internalMessage).pipe(
		Effect.andThen(
			Match.value(err).pipe(
				Match.tag(
					"UserNotFound",
					"S3ObjectNotFound",
					"MangaNotFoundInProvider",
					"MangaNotFound",
					() =>
						Effect.fail(
							new NotFoundError({
								message: "The requested resource does not exist",
							}),
						),
				),
				Match.tag(
					"SQLError",
					"EncryptionFailed",
					"SessionStoreError",
					"S3Error",
					"MangaProviderRequestFailed",
					"MangaProviderResponseInvalid",
					() =>
						Effect.fail(
							new InternalServerError({ message: "Internal server error" }),
						),
				),
				Match.tag("InvalidSession", "MissingSession", () =>
					Effect.fail(new UnauthorizedError({ message: "Invalid session" })),
				),
				Match.exhaustive,
			),
		),
	);
