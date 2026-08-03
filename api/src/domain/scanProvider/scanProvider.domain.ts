import { Schema } from "effect";

export const MangaProviderName = Schema.Literal("SUSHISCAN", "MANGA_ORIGINS");
export type MangaProviderName = typeof MangaProviderName.Type;

export const PROVIDERS: readonly MangaProviderName[] = [
	"SUSHISCAN",
	"MANGA_ORIGINS",
];

export class ProviderMangaSummary extends Schema.Class<ProviderMangaSummary>(
	"ProviderMangaSummary",
)({
	tag: Schema.NonEmptyTrimmedString,
	name: Schema.NonEmptyTrimmedString,
	updatedAt: Schema.Date,
}) {}

export class ChapterSummary extends Schema.Class<ChapterSummary>(
	"ChapterSummary",
)({
	number: Schema.Int,
	pageCount: Schema.Int,
	createdAt: Schema.Date,
}) {}

export class MangaProviderChapters extends Schema.Class<MangaProviderChapters>(
	"MangaProviderChapters",
)({
	provider: MangaProviderName,
	chapters: Schema.Array(ChapterSummary),
	tag: Schema.NonEmptyTrimmedString,
}) {}

export class ChapterPages extends Schema.Class<ChapterPages>("ChapterPages")({
	pages: Schema.Array(Schema.NonEmptyTrimmedString),
	hasNextChapter: Schema.Boolean,
}) {}
