import { HttpApi } from "@effect/platform";
import { MangaApiGroup } from "../domain/manga/manga.group.js";
import { ScanProviderApiGroup } from "../domain/scanProvider/scanProvider.group.js";
import { AuthApiGroup, UsersApiGroup } from "../domain/user/user.group.js";
import {
	BadRequestError,
	ForbiddenError,
	InternalServerError,
	NotFoundError,
	UnauthorizedError,
} from "./error.js";

export { Manga, MangaSummary } from "../domain/manga/manga.domain.js";
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
	ProviderArchive,
	ProviderMangaSummary,
} from "../domain/scanProvider/scanProvider.domain.js";
export {
	CreateUserPayload,
	LoginPayload,
	User,
} from "../domain/user/user.schema.js";

export class Api extends HttpApi.make("api")
	.add(UsersApiGroup)
	.add(AuthApiGroup)
	.add(MangaApiGroup)
	.add(ScanProviderApiGroup)
	.addError(NotFoundError, { status: 404 })
	.addError(BadRequestError, { status: 400 })
	.addError(InternalServerError, { status: 500 })
	.addError(ForbiddenError, { status: 403 })
	.addError(UnauthorizedError, { status: 401 })
	.prefix("/api") {}
