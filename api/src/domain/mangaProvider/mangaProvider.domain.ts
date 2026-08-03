import { Schema } from "effect";
import {
	mangaFormat,
	mangaGenre,
	mangaStatus,
} from "../../../drizzle/schema/mangas.js";

export const AniListId = Schema.Int.pipe(Schema.brand("AniListId"));
export type AniListId = typeof AniListId.Type;

export const AniListIdFromString = Schema.compose(
	Schema.NumberFromString,
	AniListId,
);

export const MangaFormat = Schema.Literal(...mangaFormat.enumValues);
export type MangaFormat = typeof MangaFormat.Type;

export const MangaStatus = Schema.Literal(...mangaStatus.enumValues);
export type MangaStatus = typeof MangaStatus.Type;

export const MangaGenre = Schema.Literal(...mangaGenre.enumValues);
export type MangaGenre = typeof MangaGenre.Type;

export class MangaStaff extends Schema.Class<MangaStaff>("MangaStaff")({
	name: Schema.NonEmptyTrimmedString,
	role: Schema.NonEmptyTrimmedString,
}) {}

export class MangaProviderData extends Schema.Class<MangaProviderData>(
	"MangaProviderData",
)({
	mangaId: AniListId,
	titleRomaji: Schema.NullOr(Schema.NonEmptyTrimmedString),
	titleEnglish: Schema.NullOr(Schema.NonEmptyTrimmedString),
	titleNative: Schema.NonEmptyTrimmedString,
	format: MangaFormat,
	status: MangaStatus,
	publishedAt: Schema.NullOr(Schema.Date),
	totalChapters: Schema.NullOr(Schema.Int),
	score: Schema.NullOr(Schema.Int),
	summary: Schema.NullOr(Schema.NonEmptyTrimmedString),
	coverImageUrl: Schema.NonEmptyTrimmedString,
	genres: Schema.Array(MangaGenre),
	staff: Schema.Array(MangaStaff),
}) {}
