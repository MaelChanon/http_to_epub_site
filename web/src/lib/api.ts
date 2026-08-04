import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import type {
	AniListSearchResult,
	ChapterPages,
	CreateUserPayload,
	LoginPayload,
	Manga,
	MangaProviderChapters,
	MangaProviderName,
	MangaSummary,
	ProviderArchive,
	ProviderMangaSummary,
	User,
} from "@workspace/api";
import { type AniListId, Api } from "@workspace/api";
import { Effect, Layer } from "effect";

export type {
	AniListSearchResult,
	ChapterPages,
	Manga,
	MangaProviderChapters,
	MangaSummary,
	ProviderArchive,
	ProviderMangaSummary,
	User,
} from "@workspace/api";
export { AniListId, MangaGenre, MangaProviderName } from "@workspace/api";

export class ApiError extends Error {}

const HttpClientLive = Layer.mergeAll(
	FetchHttpClient.layer,
	Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" }),
);

const client = Effect.runSync(
	Effect.provide(HttpApiClient.make(Api), HttpClientLive),
);

export function login(payload: LoginPayload): Promise<User> {
	return Effect.runPromise(
		client.auth.login({ payload }).pipe(Effect.catchAll(toApiError)),
	);
}

export function signup(payload: CreateUserPayload): Promise<User> {
	return Effect.runPromise(
		client.users.createUser({ payload }).pipe(Effect.catchAll(toApiError)),
	);
}

export function logout(): Promise<void> {
	return Effect.runPromise(
		client.auth.logout().pipe(Effect.catchAll(toApiError)),
	);
}

export function getCurrentUser(): Promise<User | null> {
	return Effect.runPromise(
		client.auth.me().pipe(Effect.catchAll(() => Effect.succeed(null))),
	);
}

export function getManga(mangaId: AniListId): Promise<Manga> {
	return Effect.runPromise(
		client.manga
			.getManga({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function refreshManga(mangaId: AniListId): Promise<Manga> {
	return Effect.runPromise(
		client.manga
			.refreshManga({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function listMangas(): Promise<readonly MangaSummary[]> {
	return Effect.runPromise(
		client.manga.listMangas().pipe(Effect.catchAll(toApiError)),
	);
}

export function searchManga(
	q: string,
): Promise<readonly AniListSearchResult[]> {
	return Effect.runPromise(
		client.manga
			.searchManga({ urlParams: { q } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function addFavorite(mangaId: AniListId): Promise<Manga> {
	return Effect.runPromise(
		client.manga
			.addFavorite({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function removeFavorite(mangaId: AniListId): Promise<Manga> {
	return Effect.runPromise(
		client.manga
			.removeFavorite({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function getMangaProviders(
	mangaId: AniListId,
): Promise<readonly MangaProviderChapters[]> {
	return Effect.runPromise(
		client.scanProvider
			.getMangaProviders({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function getChapterPages(
	mangaId: AniListId,
	provider: MangaProviderName,
	number: number,
): Promise<ChapterPages> {
	return Effect.runPromise(
		client.scanProvider
			.getMangaProviderChapterPages({ path: { mangaId, provider, number } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function syncMangaChapters(
	mangaId: AniListId,
	payload: { slug: string; provider: MangaProviderName },
): Promise<void> {
	return Effect.runPromise(
		client.scanProvider
			.syncMangaChapters({ path: { mangaId }, payload })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function deleteMangaProviderChapters(
	mangaId: AniListId,
	provider: MangaProviderName,
): Promise<void> {
	return Effect.runPromise(
		client.scanProvider
			.deleteMangaProviderChapters({ path: { mangaId, provider } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function buildProviderArchive(
	mangaId: AniListId,
	provider: MangaProviderName,
): Promise<ProviderArchive> {
	return Effect.runPromise(
		client.scanProvider
			.buildMangaProviderArchive({ path: { mangaId, provider } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function searchProviderCatalog(
	provider: MangaProviderName,
	q: string,
): Promise<readonly ProviderMangaSummary[]> {
	return Effect.runPromise(
		client.scanProvider
			.searchProviderCatalog({ path: { provider }, urlParams: { q } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

function toApiError(error: unknown): Effect.Effect<never, ApiError> {
	const message =
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof (error as { message: unknown }).message === "string"
			? (error as { message: string }).message
			: "Something went wrong";
	return Effect.fail(new ApiError(message));
}
