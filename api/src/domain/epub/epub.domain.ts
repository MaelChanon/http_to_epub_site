import { Schema } from "effect";
import { epubStatus } from "../../../drizzle/schema/epub.js";
import { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { MangaProviderName } from "../scanProvider/scanProvider.domain.js";

export const EpubId = Schema.UUID.pipe(Schema.brand("EpubId"));
export type EpubId = typeof EpubId.Type;

export const EpubStatus = Schema.Literal(...epubStatus.enumValues);
export type EpubStatus = typeof EpubStatus.Type;

export class Epub extends Schema.Class<Epub>("Epub")({
	id: EpubId,
	provider: MangaProviderName,
	chapterStart: Schema.Int,
	chapterEnd: Schema.Int,
	width: Schema.Int,
	height: Schema.Int,
	splitDoublePage: Schema.Boolean,
	creator: Schema.NonEmptyTrimmedString,
	filename: Schema.NonEmptyTrimmedString,
	status: EpubStatus,
	downloadUrl: Schema.NullOr(Schema.String),
	fileSizeBytes: Schema.NullOr(Schema.Int),
	createdAt: Schema.Date,
}) {}

export class MangaEpubs extends Schema.Class<MangaEpubs>("MangaEpubs")({
	mangaId: AniListId,
	mangaTitle: Schema.NonEmptyTrimmedString,
	mangaCoverUrl: Schema.NonEmptyTrimmedString,
	epubs: Schema.Array(Epub),
}) {}

export class CreateEpubPayload extends Schema.Class<CreateEpubPayload>(
	"CreateEpubPayload",
)({
	chapterStart: Schema.Int,
	chapterEnd: Schema.Int,
	width: Schema.Int,
	height: Schema.Int,
	splitDoublePage: Schema.Boolean,
	creator: Schema.optional(Schema.NonEmptyTrimmedString),
	filename: Schema.NonEmptyTrimmedString,
}) {}
