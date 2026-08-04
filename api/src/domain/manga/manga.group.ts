import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../../auth/auth.middleware.js";
import {
	AniListIdFromString,
	AniListSearchResult,
} from "../mangaProvider/mangaProvider.domain.js";
import { Manga, MangaSummary } from "./manga.domain.js";

const MangaPath = Schema.Struct({ mangaId: AniListIdFromString });

const SearchMangaParams = Schema.Struct({ q: Schema.NonEmptyTrimmedString });

export class MangaApiGroup extends HttpApiGroup.make("manga")
	.add(
		HttpApiEndpoint.get("listMangas", "/manga")
			.addSuccess(Schema.Array(MangaSummary))
			.middleware(Authentication),
	)
	.add(
		HttpApiEndpoint.get("searchManga", "/manga/search")
			.addSuccess(Schema.Array(AniListSearchResult))
			.middleware(Authentication)
			.setUrlParams(SearchMangaParams),
	)
	.add(
		HttpApiEndpoint.get("getManga", "/manga/:mangaId")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.get("getMangaCover", "/manga/:mangaId/cover")
			.addSuccess(HttpApiSchema.Empty(302))
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.post("refreshManga", "/manga/:mangaId/refresh")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.put("addFavorite", "/manga/:mangaId/favorite")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.del("removeFavorite", "/manga/:mangaId/favorite")
			.addSuccess(Manga)
			.middleware(Authentication)
			.setPath(MangaPath),
	) {}
