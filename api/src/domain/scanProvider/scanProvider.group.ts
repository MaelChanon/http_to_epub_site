import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import { Authentication } from "../../auth/auth.middleware.js";
import { HttpErrors } from "../../http/error.js";
import { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { NonEmptyTrimmedString } from "../schema.js";
import {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
	MangaProviderName,
	ProviderArchive,
	ProviderMangaSummary,
} from "./scanProvider.domain.js";

const MangaProviderParams = {
	mangaId: AniListId,
	provider: MangaProviderName,
};

const ChapterParams = { ...MangaProviderParams, number: Schema.Int };

const chapters = "/scan/:mangaId/providers/:provider/chapters";

export class ScanProviderApiGroup extends HttpApiGroup.make("scanProvider").add(
	HttpApiEndpoint.post("syncMangaChapters", "/scan/:mangaId/chapters", {
		params: { mangaId: AniListId },
		payload: Schema.Struct({
			slug: NonEmptyTrimmedString,
			provider: MangaProviderName,
		}),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("getMangaProviders", "/scan/:mangaId/providers", {
		params: { mangaId: AniListId },
		success: Schema.Array(MangaProviderChapters),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("getMangaProviderChapters", chapters, {
		params: MangaProviderParams,
		success: Schema.Array(ChapterSummary),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get(
		"getMangaProviderChapterPages",
		`${chapters}/:number/pages`,
		{
			params: ChapterParams,
			success: ChapterPages,
			error: HttpErrors,
		},
	).middleware(Authentication),
	HttpApiEndpoint.get(
		"getMangaProviderChapterPage",
		`${chapters}/:number/pages/:pageNumber`,
		{
			params: { ...ChapterParams, pageNumber: Schema.Int },
			success: HttpApiSchema.Empty(302),
			error: HttpErrors,
		},
	).middleware(Authentication),
	HttpApiEndpoint.get(
		"searchProviderCatalog",
		"/scan/providers/:provider/search",
		{
			params: { provider: MangaProviderName },
			query: { q: NonEmptyTrimmedString },
			success: Schema.Array(ProviderMangaSummary),
			error: HttpErrors,
		},
	).middleware(Authentication),
	HttpApiEndpoint.delete("deleteMangaProviderChapters", chapters, {
		params: MangaProviderParams,
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.post("getMangaProviderArchive", `${chapters}/archive`, {
		params: MangaProviderParams,
		success: ProviderArchive,
		error: HttpErrors,
	}).middleware(Authentication),
) {}
