import type { SQLError } from "../../drizzle/schema/utils.js";
import type { EncryptionFailed } from "../encrypt/encryptService.js";
import type {
	InvalidSession,
	MissingSession,
	SessionStoreError,
} from "../session/session.service.js";
import type { ArchiveError } from "./archive/archive.service.js";
import type {
	EpubChapterRangeEmpty,
	EpubCoverInvalid,
	EpubNotFound,
	EpubNotReady,
} from "./epub/epub.service.js";
import type { MangaNotFound } from "./manga/manga.service.js";
import type { MangaFetcherFetchFailed } from "./mangaFetcher/mangaFetcher.service.js";
import type {
	MangaNotFoundInProvider,
	MangaProviderRequestFailed,
	MangaProviderResponseInvalid,
} from "./mangaProvider/mangaProvider.service.js";
import type {
	ImageFetchFailed,
	S3Error,
	S3ObjectNotFound,
} from "./s3/s3.service.js";
import type {
	ChapterNotFound,
	MangaNotFoundById,
	MangaProviderBusy,
	MangaProviderNotLinked,
	PageNotFound,
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
	| ArchiveError
	| MangaNotFoundInProvider
	| MangaProviderRequestFailed
	| MangaProviderResponseInvalid
	| MangaNotFound
	| MangaNotFoundById
	| MangaProviderNotLinked
	| MangaProviderBusy
	| ChapterNotFound
	| PageNotFound
	| ImageFetchFailed
	| MangaFetcherFetchFailed
	| EpubNotFound
	| EpubNotReady
	| EpubChapterRangeEmpty
	| EpubCoverInvalid;
