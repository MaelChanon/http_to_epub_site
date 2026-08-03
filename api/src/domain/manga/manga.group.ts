import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../../auth/auth.middleware.js";
import { AniListIdFromString } from "../mangaProvider/mangaProvider.domain.js";
import { Manga } from "./manga.domain.js";

const MangaPath = Schema.Struct({ mangaId: AniListIdFromString });

export class MangaApiGroup extends HttpApiGroup.make("manga")
	.add(
		HttpApiEndpoint.get("getManga", "/manga/:mangaId")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.post("refreshManga", "/manga/:mangaId/refresh")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	) {}
