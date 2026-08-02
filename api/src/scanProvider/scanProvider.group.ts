import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Authentication } from "../auth/auth.middleware.js";
import { AniListIdFromString } from "../manga/manga.domain.js";
import {
	ChapterPages,
	ChapterSummary,
	MangaProviderChapters,
	MangaProviderName,
	ProviderMangaSummary,
} from "./scanProvider.domain.js";

const MangaPath = Schema.Struct({ mangaId: AniListIdFromString });

const MangaProviderPath = Schema.Struct({
	mangaId: AniListIdFromString,
	provider: MangaProviderName,
});

const MangaProviderChapterPath = Schema.Struct({
	mangaId: AniListIdFromString,
	provider: MangaProviderName,
	number: Schema.compose(Schema.NumberFromString, Schema.Int),
});

const ProviderPath = Schema.Struct({ provider: MangaProviderName });

const SearchProviderCatalogParams = Schema.Struct({
	q: Schema.NonEmptyTrimmedString,
});

const IngestMangaChaptersPayload = Schema.Struct({
	slug: Schema.NonEmptyTrimmedString,
	provider: MangaProviderName,
});

export class ScanProviderApiGroup extends HttpApiGroup.make("scanProvider")
	.add(
		HttpApiEndpoint.post("syncMangaChapters", "/scan/:mangaId/chapters")
			.addSuccess(Schema.Void)
			.middleware(Authentication)
			.setPath(MangaPath)
			.setPayload(IngestMangaChaptersPayload),
	)
	.add(
		HttpApiEndpoint.get("getMangaProviders", "/scan/:mangaId/providers")
			.addSuccess(Schema.Array(MangaProviderChapters))
			.middleware(Authentication)
			.setPath(MangaPath),
	)
	.add(
		HttpApiEndpoint.get(
			"getMangaProviderChapters",
			"/scan/:mangaId/providers/:provider/chapters",
		)
			.addSuccess(Schema.Array(ChapterSummary))
			.middleware(Authentication)
			.setPath(MangaProviderPath),
	)
	.add(
		HttpApiEndpoint.get(
			"getMangaProviderChapterPages",
			"/scan/:mangaId/providers/:provider/chapters/:number/pages",
		)
			.addSuccess(ChapterPages)
			.middleware(Authentication)
			.setPath(MangaProviderChapterPath),
	)
	.add(
		HttpApiEndpoint.get(
			"searchProviderCatalog",
			"/scan/providers/:provider/search",
		)
			.addSuccess(Schema.Array(ProviderMangaSummary))
			.middleware(Authentication)
			.setPath(ProviderPath)
			.setUrlParams(SearchProviderCatalogParams),
	) {}
