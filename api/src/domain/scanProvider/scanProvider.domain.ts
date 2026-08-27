import { Schema } from "effect";
import { mangaProviderStatus } from "../../../drizzle/schema/providers.js";

export const MangaProviderName = Schema.Literal("SUSHISCAN", "MANGA_ORIGINS");
export type MangaProviderName = typeof MangaProviderName.Type;

export const MangaProviderStatus = Schema.Literal(
	...mangaProviderStatus.enumValues,
);
export type MangaProviderStatus = typeof MangaProviderStatus.Type;

export const TRANSITIONING_STATUSES = [
	"CREATING",
	"UPDATING",
	"DELETING",
] as const satisfies readonly MangaProviderStatus[];

const transitioningStatuses = new Set<MangaProviderStatus>(
	TRANSITIONING_STATUSES,
);

export function isMangaProviderTransitioning(status: MangaProviderStatus) {
	return transitioningStatuses.has(status);
}

// A sync daemon heartbeats `manga_providers.updated_at` after every chapter, so
// a transitioning row that hasn't moved for this long belongs to a daemon that
// died with its process: the link can be taken over, and the reconciliation
// sweep resolves it to FAILED.
export const STALE_TRANSITION_MINUTES = 30;

export function staleTransitionCutoff() {
	return new Date(Date.now() - STALE_TRANSITION_MINUTES * 60 * 1000);
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
