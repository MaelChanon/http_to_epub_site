import { Effect, Match, Schema } from "effect";
import type { DomainError } from "../domain/appError.js";

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

export class ConflictError extends Schema.TaggedError<ConflictError>()(
	"ConflictError",
	{ message: Schema.String },
) {}

export type HttpError =
	| NotFoundError
	| BadRequestError
	| InternalServerError
	| ForbiddenError
	| UnauthorizedError
	| ConflictError;

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
					"MangaNotFoundById",
					"MangaProviderNotLinked",
					"ChapterNotFound",
					"PageNotFound",
					"EpubNotFound",
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
					"ArchiveError",
					"MangaProviderRequestFailed",
					"MangaProviderResponseInvalid",
					"ImageFetchFailed",
					"MangaFetcherFetchFailed",
					() =>
						Effect.fail(
							new InternalServerError({ message: "Internal server error" }),
						),
				),
				Match.tag("InvalidSession", "MissingSession", () =>
					Effect.fail(new UnauthorizedError({ message: "Invalid session" })),
				),
				Match.tag("MangaProviderBusy", () =>
					Effect.fail(
						new ConflictError({
							message: "This provider is already being processed",
						}),
					),
				),
				Match.tag("EpubNotReady", () =>
					Effect.fail(
						new ConflictError({
							message: "This epub is not ready for download yet",
						}),
					),
				),
				Match.tag("EpubChapterRangeEmpty", () =>
					Effect.fail(
						new BadRequestError({
							message: "No chapters found in the requested range",
						}),
					),
				),
				Match.tag("EpubCoverInvalid", () =>
					Effect.fail(
						new BadRequestError({
							message: "Invalid cover image",
						}),
					),
				),
				Match.exhaustive,
			),
		),
	);
