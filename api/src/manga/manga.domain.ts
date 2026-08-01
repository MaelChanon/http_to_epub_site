import { Schema } from "effect";
import { mangaFormat, mangaStatus } from "../schema/mangas.js";

export const AniListId = Schema.Int.pipe(Schema.brand("AniListId"));
export type AniListId = typeof AniListId.Type;

export const MangaFormat = Schema.Literal(...mangaFormat.enumValues);
export type MangaFormat = typeof MangaFormat.Type;

export const MangaStatus = Schema.Literal(...mangaStatus.enumValues);
export type MangaStatus = typeof MangaStatus.Type;

export class MangaProviderData extends Schema.Class<MangaProviderData>(
	"MangaProviderData",
)({
	titleRomaji: Schema.NullOr(Schema.NonEmptyTrimmedString),
	titleEnglish: Schema.NullOr(Schema.NonEmptyTrimmedString),
	titleNative: Schema.NonEmptyTrimmedString,
	format: MangaFormat,
	status: MangaStatus,
	publishedAt: Schema.NullOr(Schema.DateFromSelf),
	totalChapters: Schema.NullOr(Schema.Int),
	score: Schema.NullOr(Schema.Int),
	summary: Schema.NullOr(Schema.NonEmptyTrimmedString),
	path: Schema.NonEmptyTrimmedString,
}) {}
