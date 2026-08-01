import {
	FetchHttpClient,
	type HttpBody,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Array, Data, Effect, Option, Schema } from "effect";
import { S3Service } from "../s3/s3.service.js";
import { mangaGenre } from "../schema/mangas.js";

import {
	AniListId,
	type MangaFormat,
	type MangaGenre,
	MangaProviderData,
	MangaStaff,
	type MangaStatus,
} from "./manga.domain.js";
import {
	type AniListMedia,
	AniListMediaResponse,
} from "./mangaProvider.schema.js";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const QUERY = `
	query ($id: Int) {
		Media(id: $id, type: MANGA) {
			title {
				romaji
				english
				native
			}
			format
			status
			startDate {
				year
				month
				day
			}
			chapters
			averageScore
			description
			coverImage {
				large
			}
			genres
			staff(perPage: 25) {
				edges {
					role
					node {
						name {
							full
						}
					}
				}
			}
		}
	}
`;

const AniListRequestBody = Schema.Struct({
	query: Schema.String,
	variables: Schema.Struct({ id: AniListId }),
});

function httpBodyErrorMessage(error: HttpBody.HttpBodyError) {
	return error.reason._tag === "SchemaError"
		? error.reason.error.message
		: String(error.reason.error);
}

const FORMAT_MAP: Record<AniListMedia["format"], MangaFormat> = {
	MANGA: "SERIES",
	NOVEL: "NOVEL",
	ONE_SHOT: "ONE_SHOT",
};

const STATUS_MAP: Record<AniListMedia["status"], MangaStatus> = {
	RELEASING: "ONGOING",
	FINISHED: "FINISHED",
	CANCELLED: "CANCELLED",
	HIATUS: "HIATUS",
	NOT_YET_RELEASED: "NOT_YET_RELEASED",
};

function toPublishedAt(startDate: AniListMedia["startDate"]) {
	if (startDate.year === null) {
		return null;
	}
	// Date.UTC évite le décalage d'un jour qu'introduirait `new Date(y, m, d)`
	// (minuit en heure locale) une fois sérialisé en UTC par drizzle.
	return new Date(
		Date.UTC(startDate.year, (startDate.month ?? 1) - 1, startDate.day ?? 1),
	);
}

function coverObjectKey(anilistId: AniListId, coverUrl: string) {
	const extension = new URL(coverUrl).pathname.split(".").pop() ?? "jpg";
	return `covers/${anilistId}.${extension}`;
}

const MANGA_GENRE_VALUES = new Set<string>(mangaGenre.enumValues);

function toMangaGenre(genre: string) {
	const normalized = genre.toUpperCase().replace(/[ -]/g, "_");
	if (MANGA_GENRE_VALUES.has(normalized)) {
		return Effect.succeed(Option.some(normalized as MangaGenre));
	}
	return Effect.logWarning(`Unknown AniList genre: ${genre}`).pipe(
		Effect.as(Option.none()),
	);
}

export class MangaNotFoundInProvider extends Data.TaggedError(
	"MangaNotFoundInProvider",
)<{ readonly anilistId: AniListId }> {
	get internalMessage() {
		return `AniList manga with id=${this.anilistId} not found`;
	}
}

export class MangaProviderRequestFailed extends Data.TaggedError(
	"MangaProviderRequestFailed",
)<{ readonly message: string }> {
	get internalMessage() {
		return `AniList request failed: ${this.message}`;
	}
}

export class MangaProviderResponseInvalid extends Data.TaggedError(
	"MangaProviderResponseInvalid",
)<{ readonly message: string }> {
	get internalMessage() {
		return `AniList response could not be parsed: ${this.message}`;
	}
}

export class MangaProviderService extends Effect.Service<MangaProviderService>()(
	"api/MangaProviderService",
	{
		effect: Effect.gen(function* () {
			const client = yield* HttpClient.HttpClient;
			const s3 = yield* S3Service;

			function fetchMedia(anilistId: AniListId) {
				return Effect.gen(function* () {
					const request = yield* HttpClientRequest.post(ANILIST_ENDPOINT).pipe(
						HttpClientRequest.schemaBodyJson(AniListRequestBody)({
							query: QUERY,
							variables: { id: anilistId },
						}),
						Effect.mapError(
							(error) =>
								new MangaProviderRequestFailed({
									message: httpBodyErrorMessage(error),
								}),
						),
					);

					const response = yield* client
						.execute(request)
						.pipe(
							Effect.mapError(
								(error) =>
									new MangaProviderRequestFailed({ message: error.message }),
							),
						);

					if (response.status === 404) {
						return yield* Effect.fail(
							new MangaNotFoundInProvider({ anilistId }),
						);
					}

					const body = yield* HttpClientResponse.filterStatusOk(response).pipe(
						Effect.flatMap(
							HttpClientResponse.schemaBodyJson(AniListMediaResponse),
						),
						Effect.catchTag(
							"ParseError",
							(error) =>
								new MangaProviderResponseInvalid({ message: error.message }),
						),
						Effect.catchTag(
							"ResponseError",
							(error) =>
								new MangaProviderRequestFailed({ message: error.message }),
						),
					);

					if (body.data.Media === null) {
						return yield* Effect.fail(
							new MangaNotFoundInProvider({ anilistId }),
						);
					}

					return body.data.Media;
				});
			}

			function uploadCover(anilistId: AniListId, coverUrl: string) {
				return Effect.gen(function* () {
					const okResponse = yield* client.get(coverUrl).pipe(
						Effect.flatMap(HttpClientResponse.filterStatusOk),
						Effect.mapError(
							(error) =>
								new MangaProviderRequestFailed({ message: error.message }),
						),
					);

					const bytes = yield* okResponse.arrayBuffer.pipe(
						Effect.mapError(
							(error) =>
								new MangaProviderRequestFailed({ message: error.message }),
						),
					);

					const key = coverObjectKey(anilistId, coverUrl);
					yield* s3.upload(
						key,
						new Uint8Array(bytes),
						okResponse.headers["content-type"],
					);

					return key;
				});
			}

			function fetchById(anilistId: AniListId) {
				return Effect.gen(function* () {
					const media = yield* fetchMedia(anilistId);
					const path = yield* uploadCover(anilistId, media.coverImage.large);
					const genres = yield* Effect.forEach(media.genres, toMangaGenre).pipe(
						Effect.map(Array.getSomes),
					);

					return new MangaProviderData({
						mangaId: anilistId,
						titleRomaji: media.title.romaji,
						titleEnglish: media.title.english,
						titleNative: media.title.native,
						format: FORMAT_MAP[media.format],
						status: STATUS_MAP[media.status],
						publishedAt: toPublishedAt(media.startDate),
						totalChapters: media.chapters,
						score: media.averageScore,
						summary: media.description,
						path,
						genres,
						staff: media.staff.edges.map(
							(edge) =>
								new MangaStaff({
									name: edge.node.name.full,
									role: edge.role,
								}),
						),
					});
				});
			}

			return { fetchById };
		}),
		dependencies: [FetchHttpClient.layer, S3Service.Default],
	},
) {}
