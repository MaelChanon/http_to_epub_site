import { Schema } from "effect";
import { MangaProviderData } from "../mangaProvider/mangaProvider.domain.js";

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
}) {}
