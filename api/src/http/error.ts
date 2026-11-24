import { Effect, Match, Schema } from "effect";
import type { DomainError } from "../domain/appError.js";

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
	"NotFoundError",
	{ message: Schema.String },
	{ httpApiStatus: 404 },
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
	"ForbiddenError",
	{ message: Schema.String },
	{ httpApiStatus: 403 },
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
	"UnauthorizedError",
	{ message: Schema.String },
	{ httpApiStatus: 401 },
) {}

export class BadRequestError extends Schema.TaggedError<BadRequestError>()(
	"BadRequestError",
	{ message: Schema.String },
	{ httpApiStatus: 400 },
) {}

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
	"InternalServerError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class ConflictError extends Schema.TaggedError<ConflictError>()(
	"ConflictError",
	{ message: Schema.String },
	{ httpApiStatus: 409 },
) {}

/** Every Http error an endpoint may answer with; pass it as an endpoint's `error`. */
export const HttpErrors = [
	NotFoundError,
	BadRequestError,
	InternalServerError,
	ForbiddenError,
	UnauthorizedError,
	ConflictError,
] as const;

export type HttpError = InstanceType<(typeof HttpErrors)[number]>;

const isHttpError = (err: DomainError | HttpError): err is HttpError =>
	HttpErrors.some((HttpErrorClass) => err instanceof HttpErrorClass);

const notFound = () =>
	new NotFoundError({ message: "The requested resource does not exist" });

const internal = () =>
	new InternalServerError({ message: "Internal server error" });

const httpErrorFor = Match.type<DomainError>().pipe(
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
		notFound,
	),
	Match.tag(
		"SQLError",
		"EncryptionFailed",
		"SessionStoreError",
		"MagicLinkStoreError",
		"S3Error",
		"ArchiveError",
		"MangaProviderRequestFailed",
		"MangaProviderResponseInvalid",
		"ImageFetchFailed",
		"MangaFetcherFetchFailed",
		"ClearanceUnavailable",
		internal,
	),
	Match.tag(
		"InvalidSession",
		"MissingSession",
		() => new UnauthorizedError({ message: "Invalid session" }),
	),
	Match.tag(
		"MangaProviderBusy",
		() =>
			new ConflictError({
				message: "This provider is already being processed",
			}),
	),
	Match.tag(
		"EpubNotReady",
		() =>
			new ConflictError({
				message: "This epub is not ready for download yet",
			}),
	),
	Match.tag(
		"EpubGenerationInProgress",
		() =>
			new ConflictError({
				message: "This epub cannot be deleted while it is being generated",
			}),
	),
	Match.tag(
		"EpubChapterRangeEmpty",
		() =>
			new BadRequestError({
				message: "No chapters found in the requested range",
			}),
	),
	Match.tag(
		"EpubCoverInvalid",
		() => new BadRequestError({ message: "Invalid cover image" }),
	),
	Match.tag(
		"MagicLinkNotFound",
		() =>
			new NotFoundError({
				message: "This link is invalid or has expired",
			}),
	),
	Match.exhaustive,
);

/**
 * Logs a domain error and maps it to its Http error. An Http error raised by
 * the controller itself goes through unchanged, so a whole handler can be
 * wrapped with `Effect.catch(toHttpError)`.
 */
export const toHttpError = (
	err: DomainError | HttpError,
): Effect.Effect<never, HttpError> => {
	if (isHttpError(err)) {
		return Effect.fail(err);
	}
	return Effect.logError(err.internalMessage).pipe(
		Effect.andThen(Effect.fail(httpErrorFor(err))),
	);
};
