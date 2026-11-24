import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import { Authentication } from "../../auth/auth.middleware.js";
import { HttpErrors } from "../../http/error.js";
import {
	AniListId,
	AniListSearchResult,
} from "../mangaProvider/mangaProvider.domain.js";
import { NonEmptyTrimmedString } from "../schema.js";
import { MangaSummary, MangaWithEpub } from "./manga.domain.js";

const MangaParams = { mangaId: AniListId };

export class MangaApiGroup extends HttpApiGroup.make("manga").add(
	HttpApiEndpoint.get("listMangas", "/manga", {
		success: Schema.Array(MangaSummary),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("searchManga", "/manga/search", {
		query: { q: NonEmptyTrimmedString },
		success: Schema.Array(AniListSearchResult),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("getManga", "/manga/:mangaId", {
		params: MangaParams,
		success: MangaWithEpub,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("getMangaCover", "/manga/:mangaId/cover", {
		params: MangaParams,
		success: HttpApiSchema.Empty(302),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.post("refreshManga", "/manga/:mangaId/refresh", {
		params: MangaParams,
		success: MangaWithEpub,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.put("addFavorite", "/manga/:mangaId/favorite", {
		params: MangaParams,
		success: MangaWithEpub,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.delete("removeFavorite", "/manga/:mangaId/favorite", {
		params: MangaParams,
		success: MangaWithEpub,
		error: HttpErrors,
	}).middleware(Authentication),
) {}
