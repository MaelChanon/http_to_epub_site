import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import type { CreateUserPayload, LoginPayload, User } from "@workspace/api";
import { Api } from "@workspace/api";
import { Effect, Layer } from "effect";

export type { User } from "@workspace/api";

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
