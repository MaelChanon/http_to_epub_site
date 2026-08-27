import { Schema } from "effect";
import { mangaProviderStatus } from "../../../drizzle/schema/providers.js";

export const MangaProviderName = Schema.Literal("SUSHISCAN", "MANGA_ORIGINS");
export type MangaProviderName = typeof MangaProviderName.Type;

export const MangaProviderStatus = Schema.Literal(
	...mangaProviderStatus.enumValues,
);
export type MangaProviderStatus = typeof MangaProviderStatus.Type;

const TRANSITIONING_STATUSES = new Set<MangaProviderStatus>([
	"CREATING",
	"UPDATING",
	"DELETING",
]);

export function isMangaProviderTransitioning(status: MangaProviderStatus) {
	return TRANSITIONING_STATUSES.has(status);
}

export const PROVIDERS: readonly MangaProviderName[] = [
	"SUSHISCAN",
	"MANGA_ORIGINS",
];

export class ProviderMangaSummary extends Schema.Class<ProviderMangaSummary>(
	"ProviderMangaSummary",
)({
	tag: Schema.NonEmptyTrimmedString,
	name: Schema.NonEmptyTrimmedString,
	chapterCount: Schema.Int,
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
	status: MangaProviderStatus,
	chapterCount: Schema.Int,
}) {}

export class ChapterPages extends Schema.Class<ChapterPages>("ChapterPages")({
	pages: Schema.Array(Schema.NonEmptyTrimmedString),
	hasNextChapter: Schema.Boolean,
}) {}

export class ProviderArchive extends Schema.Class<ProviderArchive>(
	"ProviderArchive",
)({
	url: Schema.NonEmptyTrimmedString,
}) {}

export class ScanEvent extends Schema.Class<ScanEvent>("ScanEvent")({
	provider: MangaProviderName,
	status: Schema.NullOr(MangaProviderStatus),
}) {}
