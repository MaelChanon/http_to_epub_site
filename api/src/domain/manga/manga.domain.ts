import { Schema } from "effect";
import { MangaProviderData } from "../mangaProvider/mangaProvider.domain.js";
import { MangaProviderName } from "../scanProvider/scanProvider.domain.js";

export const MangaDbId = Schema.UUID.pipe(Schema.brand("MangaDbId"));
export type MangaDbId = typeof MangaDbId.Type;

const {
	coverImageUrl: _coverImageUrl,
	...mangaProviderDataFieldsWithoutCover
} = MangaProviderData.fields;

export class Manga extends Schema.Class<Manga>("Manga")({
	...mangaProviderDataFieldsWithoutCover,
	id: MangaDbId,
	coverUrl: Schema.NonEmptyTrimmedString,
	isFavorite: Schema.Boolean,
}) {}

const {
	summary: _summary,
	staff: _staff,
	...mangaSummaryBaseFields
} = mangaProviderDataFieldsWithoutCover;

export class MangaSummary extends Schema.Class<MangaSummary>("MangaSummary")({
	...mangaSummaryBaseFields,
	id: MangaDbId,
	coverUrl: Schema.NonEmptyTrimmedString,
	providers: Schema.Array(MangaProviderName),
	isFavorite: Schema.Boolean,
	latestChapterAt: Schema.NullOr(Schema.Date),
}) {}
