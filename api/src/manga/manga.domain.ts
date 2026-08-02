import { Schema } from "effect";
import { mangaFormat, mangaGenre, mangaStatus } from "../schema/mangas.js";

export const AniListId = Schema.Int.pipe(Schema.brand("AniListId"));
export type AniListId = typeof AniListId.Type;

// Décode le paramètre de route (string) directement vers le même type brandé
// que celui utilisé par MangaProviderService.fetchById.
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

export const MangaDbId = Schema.UUID.pipe(Schema.brand("MangaDbId"));
export type MangaDbId = typeof MangaDbId.Type;

export const MangaProviderName = Schema.Literal("SUSHISCAN", "MANGA_ORIGINS");
export type MangaProviderName = typeof MangaProviderName.Type;

const {
	coverImageUrl: _coverImageUrl,
	...mangaProviderDataFieldsWithoutCover
} = MangaProviderData.fields;

export class Manga extends Schema.Class<Manga>("Manga")({
	...mangaProviderDataFieldsWithoutCover,
	id: MangaDbId,
	coverUrl: Schema.NonEmptyTrimmedString,
}) {}
