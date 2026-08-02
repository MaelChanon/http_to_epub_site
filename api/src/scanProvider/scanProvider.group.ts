import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../auth/auth.middleware.js";
import {
	AniListIdFromString,
	MangaProviderName,
} from "../manga/manga.domain.js";

const MangaPath = Schema.Struct({ mangaId: AniListIdFromString });

const IngestMangaChaptersPayload = Schema.Struct({
	slug: Schema.NonEmptyTrimmedString,
	provider: MangaProviderName,
});

export class ScanProviderApiGroup extends HttpApiGroup.make("scanProvider").add(
	HttpApiEndpoint.post("syncMangaChapters", "/scan/:mangaId/chapters")
		.addSuccess(Schema.Void)
		.middleware(Authentication)
		.setPath(MangaPath)
		.setPayload(IngestMangaChaptersPayload),
) {}
