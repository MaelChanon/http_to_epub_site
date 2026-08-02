import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import type {
	CreateUserPayload,
	LoginPayload,
	Manga,
	MangaProviderChapters,
	User,
} from "@workspace/api";
import { type AniListId, Api } from "@workspace/api";
import { Effect, Layer } from "effect";

export type {
	Manga,
	MangaProviderChapters,
	MangaProviderName,
	User,
} from "@workspace/api";
export { AniListId } from "@workspace/api";

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

export function getMangaProviders(
	mangaId: AniListId,
): Promise<readonly MangaProviderChapters[]> {
	return Effect.runPromise(
		client.scanProvider
			.getMangaProviders({ path: { mangaId } })
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
