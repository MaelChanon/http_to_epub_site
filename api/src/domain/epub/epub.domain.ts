import { Schema } from "effect";
import { epubStatus } from "../../../drizzle/schema/epub.js";
import { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { MangaProviderName } from "../scanProvider/scanProvider.domain.js";
import { NonEmptyTrimmedString, UUID } from "../schema.js";

export const EpubId = UUID.pipe(Schema.brand("EpubId"));
export type EpubId = typeof EpubId.Type;

export const EpubStatus = Schema.Literals(epubStatus.enumValues);
export type EpubStatus = typeof EpubStatus.Type;

export class Epub extends Schema.Class<Epub>("Epub")({
	id: EpubId,
	provider: MangaProviderName,
	chapterStart: Schema.Int,
	chapterEnd: Schema.Int,
	width: Schema.Int,
	height: Schema.Int,
	splitDoublePage: Schema.Boolean,
	creator: NonEmptyTrimmedString,
	filename: NonEmptyTrimmedString,
	status: EpubStatus,
	downloadUrl: Schema.NullOr(Schema.String),
	fileSizeBytes: Schema.NullOr(Schema.Int),
	createdAt: Schema.Date,
}) {}

export class MangaEpubs extends Schema.Class<MangaEpubs>("MangaEpubs")({
	mangaId: AniListId,
	mangaTitle: NonEmptyTrimmedString,
	mangaCoverUrl: NonEmptyTrimmedString,
	epubs: Schema.Array(Epub),
}) {}

export const EpubCoverContentType = Schema.Literals([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export class UploadEpubCoverPayload extends Schema.Class<UploadEpubCoverPayload>(
	"UploadEpubCoverPayload",
)({
	contentType: EpubCoverContentType,
	data: NonEmptyTrimmedString,
}) {}
export class CreateEpubPayload extends Schema.Class<CreateEpubPayload>(
	"CreateEpubPayload",
)({
	chapterStart: Schema.Int,
	chapterEnd: Schema.Int,
	width: Schema.Int,
	height: Schema.Int,
	splitDoublePage: Schema.Boolean,
	creator: Schema.optional(NonEmptyTrimmedString),
	filename: NonEmptyTrimmedString,
	cover: Schema.optional(UploadEpubCoverPayload),
}) {}

export type EpubCoverContentType = typeof EpubCoverContentType.Type;

export class EpubCoverUpload extends Schema.Class<EpubCoverUpload>(
	"EpubCoverUpload",
)({
	coverKey: NonEmptyTrimmedString,
}) {}
