import type {
	AniListSearchResult,
	ChapterPages,
	Epub,
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
import {
	type AniListId,
	Api,
	CreateEpubPayload,
	CreateInvitePayload,
	CreateUserPayload,
	LoginPayload,
	ResetPasswordPayload,
	UploadEpubCoverPayload,
} from "@workspace/api";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";

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

/** Runs a client call as a Promise; any failure rejects with an `ApiError`. */
function run<A, E>(call: Effect.Effect<A, E>): Promise<A> {
	return Effect.runPromise(call.pipe(Effect.catch(toApiError)));
}

export function login(payload: LoginPayload): Promise<User> {
	return run(client.auth.login({ payload: new LoginPayload(payload) }));
}

export function logout(): Promise<void> {
	return run(client.auth.logout());
}

export function getCurrentUser(): Promise<User | null> {
	return run(
		client.auth
			.me()
			.pipe(Effect.catchTag("UnauthorizedError", () => Effect.succeed(null))),
	);
}

export function listUsers(): Promise<readonly User[]> {
	return run(client.users.listUsers());
}

export function updateUserPermissions(
	id: User["id"],
	permissions: readonly Permission[],
): Promise<User> {
	return run(
		client.users.updateUserPermissions({
			params: { id },
			payload: { permissions },
		}),
	);
}

export function deleteUser(id: User["id"]): Promise<void> {
	return run(client.users.deleteUser({ params: { id } }));
}

export function acceptInvite(
	token: string,
	values: { pseudo: string; email: string; password: string },
): Promise<User> {
	return run(
		client.users.createUser({
			payload: new CreateUserPayload({ ...values, token }),
		}),
	);
}

export function createInvite(
	permissions: readonly Permission[],
): Promise<MagicLink> {
	return run(
		client.users.createInvite({
			payload: new CreateInvitePayload({ permissions }),
		}),
	);
}

export function createPasswordReset(id: User["id"]): Promise<MagicLink> {
	return run(client.users.createPasswordReset({ params: { id } }));
}

export function getPasswordReset(token: string): Promise<PasswordResetPreview> {
	return run(client.auth.getPasswordReset({ params: { token } }));
}

export function resetPassword(token: string, password: string): Promise<void> {
	return run(
		client.auth.resetPassword({
			params: { token },
			payload: new ResetPasswordPayload({ password }),
		}),
	);
}

export function getManga(mangaId: AniListId) {
	return run(client.manga.getManga({ params: { mangaId } }));
}

export function refreshManga(mangaId: AniListId) {
	return run(client.manga.refreshManga({ params: { mangaId } }));
}

export function listMangas(): Promise<readonly MangaSummary[]> {
	return run(client.manga.listMangas());
}

export function searchManga(
	q: string,
): Promise<readonly AniListSearchResult[]> {
	return run(client.manga.searchManga({ query: { q } }));
}

export function addFavorite(mangaId: AniListId): Promise<Manga> {
	return run(client.manga.addFavorite({ params: { mangaId } }));
}

export function removeFavorite(mangaId: AniListId): Promise<Manga> {
	return run(client.manga.removeFavorite({ params: { mangaId } }));
}

export function getMangaProviders(
	mangaId: AniListId,
): Promise<readonly MangaProviderChapters[]> {
	return run(client.scanProvider.getMangaProviders({ params: { mangaId } }));
}

export function getChapterPages(
	mangaId: AniListId,
	provider: MangaProviderName,
	number: number,
): Promise<ChapterPages> {
	return run(
		client.scanProvider.getMangaProviderChapterPages({
			params: { mangaId, provider, number },
		}),
	);
}

export function syncMangaChapters(
	mangaId: AniListId,
	payload: { slug: string; provider: MangaProviderName },
): Promise<void> {
	return run(
		client.scanProvider.syncMangaChapters({ params: { mangaId }, payload }),
	);
}

export function deleteMangaProviderChapters(
	mangaId: AniListId,
	provider: MangaProviderName,
): Promise<void> {
	return run(
		client.scanProvider.deleteMangaProviderChapters({
			params: { mangaId, provider },
		}),
	);
}

export function buildProviderArchive(
	mangaId: AniListId,
	provider: MangaProviderName,
): Promise<ProviderArchive> {
	return run(
		client.scanProvider.getMangaProviderArchive({
			params: { mangaId, provider },
		}),
	);
}

export function generateEpub(
	mangaId: AniListId,
	provider: MangaProviderName,
	payload: CreateEpubPayload,
): Promise<Epub> {
	return run(
		client.epub.createEpub({
			params: { mangaId, provider },
			payload: new CreateEpubPayload({
				...payload,
				cover: payload.cover && new UploadEpubCoverPayload(payload.cover),
			}),
		}),
	);
}

export function listEpubs(): Promise<readonly MangaEpubs[]> {
	return run(client.epub.listEpubs());
}

export function deleteEpub(id: Epub["id"]): Promise<void> {
	return run(client.epub.deleteEpub({ params: { id } }));
}

export function searchProviderCatalog(
	provider: MangaProviderName,
	q: string,
): Promise<readonly ProviderMangaSummary[]> {
	return run(
		client.scanProvider.searchProviderCatalog({
			params: { provider },
			query: { q },
		}),
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
