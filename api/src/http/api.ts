import { HttpApi } from "effect/http-api";
import { EpubApiGroup } from "../domain/epub/epub.group.js";
import { MangaApiGroup } from "../domain/manga/manga.group.js";
import { ScanProviderApiGroup } from "../domain/scanProvider/scanProvider.group.js";
import { AuthApiGroup, UsersApiGroup } from "../domain/user/user.group.js";

export {
	CreateEpubPayload,
	Epub,
	EpubCoverContentType,
	EpubCoverUpload,
	EpubStatus,
	MangaEpubs,
	UploadEpubCoverPayload,
} from "../domain/epub/epub.domain.js";
export {
	Manga,
	MangaSummary,
	MangaWithEpub,
} from "../domain/manga/manga.domain.js";
export {
	AniListId,
	AniListSearchResult,
	MangaGenre,
} from "../domain/mangaProvider/mangaProvider.domain.js";
export {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
	MangaProviderName,
	MangaProviderStatus,
	ProviderArchive,
	ProviderMangaSummary,
	ScanEvent,
} from "../domain/scanProvider/scanProvider.domain.js";
export {
	CreateInvitePayload,
	CreateUserPayload,
	LoginPayload,
	MagicLink,
	PasswordResetPreview,
	Permission,
	ResetPasswordPayload,
	User,
} from "../domain/user/user.schema.js";

export class Api extends HttpApi.make("api")
	.add(
		UsersApiGroup,
		AuthApiGroup,
		MangaApiGroup,
		ScanProviderApiGroup,
		EpubApiGroup,
	)
	.prefix("/api") {}
