import {
	Array as Arr,
	Context,
	Data,
	Effect,
	Layer,
	Option,
	Schema,
} from "effect";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import { mangaGenre } from "../../../drizzle/schema/mangas.js";
import {
	AniListId,
	AniListSearchResult,
	type MangaFormat,
	type MangaGenre,
	MangaProviderData,
	MangaStaff,
	type MangaStatus,
} from "./mangaProvider.domain.js";
import {
	type AniListMedia,
	AniListMediaResponse,
	AniListSearchResponse,
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

const SEARCH_QUERY = `
	query ($search: String, $perPage: Int) {
		Page(page: 1, perPage: $perPage) {
			media(search: $search, type: MANGA) {
				id
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
				averageScore
				coverImage {
					large
				}
			}
		}
	}
`;

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

function titleNative(title: AniListMedia["title"]) {
	return title.native ?? title.romaji ?? title.english ?? "";
}

const make = Effect.gen(function* () {
	const client = yield* HttpClient.HttpClient;

	/** POSTs a GraphQL query; a non-2xx status other than 404 is a request failure. */
	const post = (query: string, variables: Record<string, unknown>) =>
		HttpClientRequest.post(ANILIST_ENDPOINT).pipe(
			HttpClientRequest.bodyJsonUnsafe({ query, variables }),
			client.execute,
			Effect.mapError(
				(error) => new MangaProviderRequestFailed({ message: error.message }),
			),
		);

	const decodeBody =
		<S extends Schema.Decoder<unknown>>(schema: S) =>
		(response: HttpClientResponse.HttpClientResponse) =>
			HttpClientResponse.filterStatusOk(response).pipe(
				Effect.flatMap((ok) => ok.json),
				Effect.mapError(
					(error) => new MangaProviderRequestFailed({ message: error.message }),
				),
				Effect.flatMap(Schema.decodeUnknownEffect(schema)),
				Effect.mapError((error) =>
					error._tag === "SchemaError"
						? new MangaProviderResponseInvalid({ message: error.message })
						: error,
				),
			);

	const fetchMedia = Effect.fn("MangaProviderService.fetchMedia")(function* (
		anilistId: AniListId,
	) {
		const response = yield* post(QUERY, { id: anilistId });
		if (response.status === 404) {
			return yield* new MangaNotFoundInProvider({ anilistId });
		}
		const body = yield* decodeBody(AniListMediaResponse)(response);
		if (body.data.Media === null) {
			return yield* new MangaNotFoundInProvider({ anilistId });
		}
		return body.data.Media;
	});

	const fetchById = Effect.fn("MangaProviderService.fetchById")(function* (
		anilistId: AniListId,
	) {
		const media = yield* fetchMedia(anilistId);
		const genres = Arr.getSomes(
			yield* Effect.forEach(media.genres, toMangaGenre),
		);

		return new MangaProviderData({
			mangaId: anilistId,
			titleRomaji: media.title.romaji,
			titleEnglish: media.title.english,
			titleNative: titleNative(media.title),
			format: FORMAT_MAP[media.format],
			status: STATUS_MAP[media.status],
			publishedAt: toPublishedAt(media.startDate),
			totalChapters: media.chapters,
			score: media.averageScore,
			summary: media.description,
			coverImageUrl: media.coverImage.large,
			genres,
			staff: media.staff.edges.map(
				(edge) =>
					new MangaStaff({ name: edge.node.name.full, role: edge.role }),
			),
		});
	});

	const searchMedia = Effect.fn("MangaProviderService.searchMedia")(function* (
		query: string,
	) {
		const response = yield* post(SEARCH_QUERY, { search: query, perPage: 20 });
		const body = yield* decodeBody(AniListSearchResponse)(response);

		return body.data.Page.media.map(
			(media) =>
				new AniListSearchResult({
					mangaId: AniListId.make(media.id),
					titleRomaji: media.title.romaji,
					titleEnglish: media.title.english,
					titleNative: titleNative(media.title),
					format: FORMAT_MAP[media.format],
					status: STATUS_MAP[media.status],
					publishedAt: toPublishedAt(media.startDate),
					score: media.averageScore,
					coverImageUrl: media.coverImage.large,
				}),
		);
	});

	return { fetchById, searchMedia };
});

export class MangaProviderService extends Context.Service<MangaProviderService>()(
	"api/MangaProviderService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(FetchHttpClient.layer),
	);
}
