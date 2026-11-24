import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import { Authentication } from "../../auth/auth.middleware.js";
import { HttpErrors } from "../../http/error.js";
import { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { MangaProviderName } from "../scanProvider/scanProvider.domain.js";
import { CreateEpubPayload, Epub, EpubId, MangaEpubs } from "./epub.domain.js";

const EpubIdParams = { id: EpubId };

export class EpubApiGroup extends HttpApiGroup.make("epub").add(
	HttpApiEndpoint.post(
		"createEpub",
		"/epub/manga/:mangaId/providers/:provider",
		{
			params: { mangaId: AniListId, provider: MangaProviderName },
			payload: CreateEpubPayload,
			success: Epub,
			error: HttpErrors,
		},
	).middleware(Authentication),
	HttpApiEndpoint.get("listEpubs", "/epub", {
		success: Schema.Array(MangaEpubs),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.get("downloadEpub", "/epub/:id/download", {
		params: EpubIdParams,
		success: HttpApiSchema.Empty(302),
		error: HttpErrors,
	}).middleware(Authentication),
	HttpApiEndpoint.delete("deleteEpub", "/epub/:id", {
		params: EpubIdParams,
		error: HttpErrors,
	}).middleware(Authentication),
) {}
