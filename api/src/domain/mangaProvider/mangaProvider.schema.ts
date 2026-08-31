import { Schema } from "effect";

export const AniListFormat = Schema.Literal("MANGA", "NOVEL", "ONE_SHOT");

export const AniListStatus = Schema.Literal(
	"FINISHED",
	"RELEASING",
	"NOT_YET_RELEASED",
	"CANCELLED",
	"HIATUS",
);

export const AniListDate = Schema.Struct({
	year: Schema.NullOr(Schema.Int),
	month: Schema.NullOr(Schema.Int),
	day: Schema.NullOr(Schema.Int),
});

export const AniListStaffEdge = Schema.Struct({
	role: Schema.NonEmptyTrimmedString,
	node: Schema.Struct({
		name: Schema.Struct({ full: Schema.NonEmptyTrimmedString }),
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
	description: Schema.NullOr(
		Schema.compose(Schema.NonEmptyString, Schema.Trim).pipe(
			Schema.minLength(1),
		),
	),
	coverImage: Schema.Struct({
		large: Schema.NonEmptyTrimmedString,
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
		large: Schema.NonEmptyTrimmedString,
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
