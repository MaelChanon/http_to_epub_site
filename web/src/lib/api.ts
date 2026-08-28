import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import type {
	AniListSearchResult,
	ChapterPages,
	CreateEpubPayload,
	Epub,
	LoginPayload,
	MagicLink,
	Manga,
	MangaEpubs,
	MangaProviderChapters,
	MangaProviderName,
	MangaSummary,
	PasswordResetPreview,
	Permission,
	ProviderArchive,
	ProviderMangaSummary,
	User,
} from "@workspace/api";
import { type AniListId, Api } from "@workspace/api";
import { Effect, Layer } from "effect";

export type {
	AniListSearchResult,
	ChapterPages,
	CreateEpubPayload,
	Epub,
	EpubCoverContentType,
	EpubCoverUpload,
	MagicLink,
	Manga,
	MangaEpubs,
	MangaProviderChapters,
	MangaSummary,
	PasswordResetPreview,
	ProviderArchive,
	ProviderMangaSummary,
} from "@workspace/api";
export {
	AniListId,
	EpubStatus,
	MangaGenre,
	MangaProviderName,
	MangaProviderStatus,
	Permission,
	ScanEvent,
	User,
} from "@workspace/api";

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

export function logout(): Promise<void> {
	return Effect.runPromise(
		client.auth.logout().pipe(Effect.catchAll(toApiError)),
	);
}

export function getCurrentUser(): Promise<User | null> {
	return Effect.runPromise(
		client.auth.me().pipe(
			Effect.catchTag("UnauthorizedError", () => Effect.succeed(null)),
			Effect.catchAll(toApiError),
		),
	);
}

export function listUsers(): Promise<readonly User[]> {
	return Effect.runPromise(
		client.users.listUsers().pipe(Effect.catchAll(toApiError)),
	);
}

export function updateUserPermissions(
	id: User["id"],
	permissions: readonly Permission[],
): Promise<User> {
	return Effect.runPromise(
		client.users
			.updateUserPermissions({ path: { id }, payload: { permissions } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function deleteUser(id: User["id"]): Promise<void> {
	return Effect.runPromise(
		client.users.deleteUser({ path: { id } }).pipe(Effect.catchAll(toApiError)),
	);
}

export function acceptInvite(
	token: string,
	values: { pseudo: string; email: string; password: string },
): Promise<User> {
	return Effect.runPromise(
		client.users
			.createUser({ payload: { ...values, token } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function createInvite(
	permissions: readonly Permission[],
): Promise<MagicLink> {
	return Effect.runPromise(
		client.users
			.createInvite({ payload: { permissions } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function createPasswordReset(id: User["id"]): Promise<MagicLink> {
	return Effect.runPromise(
		client.users
			.createPasswordReset({ path: { id } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function getPasswordReset(token: string): Promise<PasswordResetPreview> {
	return Effect.runPromise(
		client.auth
			.getPasswordReset({ path: { token } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function resetPassword(token: string, password: string): Promise<void> {
	return Effect.runPromise(
		client.auth
			.resetPassword({ path: { token }, payload: { password } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function getManga(mangaId: AniListId) {
	return Effect.runPromise(
		client.manga
			.getManga({ path: { mangaId } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function refreshManga(mangaId: AniListId) {
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
			.getMangaProviderArchive({ path: { mangaId, provider } })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function generateEpub(
	mangaId: AniListId,
	provider: MangaProviderName,
	payload: CreateEpubPayload,
): Promise<Epub> {
	return Effect.runPromise(
		client.epub
			.createEpub({ path: { mangaId, provider }, payload })
			.pipe(Effect.catchAll(toApiError)),
	);
}

export function listEpubs(): Promise<readonly MangaEpubs[]> {
	return Effect.runPromise(
		client.epub.listEpubs().pipe(Effect.catchAll(toApiError)),
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
