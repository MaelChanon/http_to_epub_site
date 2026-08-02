import type { SQLError } from "../../drizzle/schema/utils.js";
import type { EncryptionFailed } from "../encrypt/encryptService.js";
import type {
	InvalidSession,
	MissingSession,
	SessionStoreError,
} from "../session/session.service.js";
import type { MangaNotFound } from "./manga/manga.service.js";
import type {
	MangaNotFoundInProvider,
	MangaProviderRequestFailed,
	MangaProviderResponseInvalid,
} from "./manga/mangaProvider.service.js";
import type { MangaNativeFetchFailed } from "./mangaNative/mangaNative.service.js";
import type {
	ImageFetchFailed,
	S3Error,
	S3ObjectNotFound,
} from "./s3/s3.service.js";
import type {
	ChapterNotFound,
	MangaNotFoundById,
	MangaProviderNotLinked,
} from "./scanProvider/scanProvider.service.js";
import type { UserNotFound } from "./user/user.repository.js";

export type DomainError =
	| UserNotFound
	| SQLError
	| EncryptionFailed
	| InvalidSession
	| MissingSession
	| SessionStoreError
	| S3ObjectNotFound
	| S3Error
	| MangaNotFoundInProvider
	| MangaProviderRequestFailed
	| MangaProviderResponseInvalid
	| MangaNotFound
	| MangaNotFoundById
	| MangaProviderNotLinked
	| ChapterNotFound
	| ImageFetchFailed
	| MangaNativeFetchFailed;
