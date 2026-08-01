import type { EncryptionFailed } from "./encrypt/encryptService.js";
import type { SQLError } from "./schema/utils.js";
import type {
	InvalidSession,
	MissingSession,
	SessionStoreError,
} from "./session/session.service.js";
import type { UserNotFound } from "./user/user.repository.js";

export type DomainError =
	| UserNotFound
	| SQLError
	| EncryptionFailed
	| InvalidSession
	| MissingSession
	| SessionStoreError;
