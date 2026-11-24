import { Schema } from "effect";
import {
	mangaFormat,
	mangaGenre,
	mangaStatus,
} from "../../../drizzle/schema/mangas.js";
import { NonEmptyTrimmedString } from "../schema.js";

export const AniListId = Schema.Int.pipe(Schema.brand("AniListId"));
export type AniListId = typeof AniListId.Type;

export const AniListIdFromString = Schema.NumberFromString.pipe(
	Schema.decodeTo(AniListId),
);

export const MangaFormat = Schema.Literals(mangaFormat.enumValues);
export type MangaFormat = typeof MangaFormat.Type;

export const MangaStatus = Schema.Literals(mangaStatus.enumValues);
export type MangaStatus = typeof MangaStatus.Type;

export const MangaGenre = Schema.Literals(mangaGenre.enumValues);
export type MangaGenre = typeof MangaGenre.Type;

export class MangaStaff extends Schema.Class<MangaStaff>("MangaStaff")({
	name: NonEmptyTrimmedString,
	role: NonEmptyTrimmedString,
}) {}

export class MangaProviderData extends Schema.Class<MangaProviderData>(
	"MangaProviderData",
)({
	mangaId: AniListId,
	titleRomaji: Schema.NullOr(NonEmptyTrimmedString),
	titleEnglish: Schema.NullOr(NonEmptyTrimmedString),
	titleNative: NonEmptyTrimmedString,
	format: MangaFormat,
	status: MangaStatus,
	publishedAt: Schema.NullOr(Schema.Date),
	totalChapters: Schema.NullOr(Schema.Int),
	score: Schema.NullOr(Schema.Int),
	summary: Schema.NullOr(NonEmptyTrimmedString),
	coverImageUrl: NonEmptyTrimmedString,
	genres: Schema.Array(MangaGenre),
	staff: Schema.Array(MangaStaff),
}) {}

export class AniListSearchResult extends Schema.Class<AniListSearchResult>(
	"AniListSearchResult",
)({
	mangaId: AniListId,
	titleRomaji: Schema.NullOr(NonEmptyTrimmedString),
	titleEnglish: Schema.NullOr(NonEmptyTrimmedString),
	titleNative: NonEmptyTrimmedString,
	format: MangaFormat,
	status: MangaStatus,
	publishedAt: Schema.NullOr(Schema.Date),
	score: Schema.NullOr(Schema.Int),
	coverImageUrl: NonEmptyTrimmedString,
}) {}
