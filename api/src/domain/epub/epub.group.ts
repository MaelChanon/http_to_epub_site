import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../../auth/auth.middleware.js";
import { AniListIdFromString } from "../mangaProvider/mangaProvider.domain.js";
import { MangaProviderName } from "../scanProvider/scanProvider.domain.js";
import { CreateEpubPayload, Epub, EpubId, MangaEpubs } from "./epub.domain.js";

const MangaProviderPath = Schema.Struct({
	mangaId: AniListIdFromString,
	provider: MangaProviderName,
});

const EpubIdPath = Schema.Struct({ id: EpubId });

export class EpubApiGroup extends HttpApiGroup.make("epub")
	.add(
		HttpApiEndpoint.post(
			"createEpub",
			"/epub/manga/:mangaId/providers/:provider",
		)
			.addSuccess(Epub)
			.middleware(Authentication)
			.setPath(MangaProviderPath)
			.setPayload(CreateEpubPayload),
	)
	.add(
		HttpApiEndpoint.get("listEpubs", "/epub")
			.addSuccess(Schema.Array(MangaEpubs))
			.middleware(Authentication),
	)
	.add(
		HttpApiEndpoint.get("downloadEpub", "/epub/:id/download")
			.addSuccess(HttpApiSchema.Empty(302))
			.middleware(Authentication)
			.setPath(EpubIdPath),
	) {}
