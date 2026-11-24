import { Schema } from "effect";
import { NonEmptyTrimmedString } from "../schema.js";

export const AniListFormat = Schema.Literals(["MANGA", "NOVEL", "ONE_SHOT"]);

export const AniListStatus = Schema.Literals([
	"FINISHED",
	"RELEASING",
	"NOT_YET_RELEASED",
	"CANCELLED",
	"HIATUS",
]);

export const AniListDate = Schema.Struct({
	year: Schema.NullOr(Schema.Int),
	month: Schema.NullOr(Schema.Int),
	day: Schema.NullOr(Schema.Int),
});

/** Trims the input, then requires something left. */
const TrimmedNonEmptyString = Schema.Trim.check(Schema.isNonEmpty());

export const AniListStaffEdge = Schema.Struct({
	role: TrimmedNonEmptyString,
	node: Schema.Struct({
		name: Schema.Struct({ full: TrimmedNonEmptyString }),
	}),
});

export const AniListMedia = Schema.Struct({
	title: Schema.Struct({
		romaji: Schema.NullOr(Schema.String),
		english: Schema.NullOr(Schema.String),
		native: Schema.NullOr(Schema.String),
	}),
	format: AniListFormat,
	status: AniListStatus,
	startDate: AniListDate,
	chapters: Schema.NullOr(Schema.Int),
	averageScore: Schema.NullOr(Schema.Int),
	description: Schema.NullOr(TrimmedNonEmptyString),
	coverImage: Schema.Struct({
		large: NonEmptyTrimmedString,
	}),
	genres: Schema.Array(Schema.String),
	staff: Schema.Struct({
		edges: Schema.Array(AniListStaffEdge),
	}),
});
export type AniListMedia = typeof AniListMedia.Type;

export const AniListMediaResponse = Schema.Struct({
	data: Schema.Struct({
		Media: Schema.NullOr(AniListMedia),
	}),
});
export type AniListMediaResponse = typeof AniListMediaResponse.Type;

export const AniListSearchMedia = Schema.Struct({
	id: Schema.Int,
	title: Schema.Struct({
		romaji: Schema.NullOr(Schema.String),
		english: Schema.NullOr(Schema.String),
		native: Schema.NullOr(Schema.String),
	}),
	format: AniListFormat,
	status: AniListStatus,
	startDate: AniListDate,
	averageScore: Schema.NullOr(Schema.Int),
	coverImage: Schema.Struct({
		large: NonEmptyTrimmedString,
	}),
});
export type AniListSearchMedia = typeof AniListSearchMedia.Type;

export const AniListSearchResponse = Schema.Struct({
	data: Schema.Struct({
		Page: Schema.Struct({
			media: Schema.Array(AniListSearchMedia),
		}),
	}),
});
export type AniListSearchResponse = typeof AniListSearchResponse.Type;
