import { HttpApi } from "@effect/platform";
import {
	BadRequestError,
	ForbiddenError,
	InternalServerError,
	NotFoundError,
	UnauthorizedError,
} from "./error.js";
import { MangaApiGroup } from "./manga/manga.group.js";
import { AuthApiGroup, UsersApiGroup } from "./user/user.group.js";

export { AniListId, Manga } from "./manga/manga.domain.js";
export { CreateUserPayload, LoginPayload, User } from "./user/user.schema.js";

export class Api extends HttpApi.make("api")
	.add(UsersApiGroup)
	.add(AuthApiGroup)
	.add(MangaApiGroup)
	.addError(NotFoundError, { status: 404 })
	.addError(BadRequestError, { status: 400 })
	.addError(InternalServerError, { status: 500 })
	.addError(ForbiddenError, { status: 403 })
	.addError(UnauthorizedError, { status: 401 })
	.prefix("/api") {}
