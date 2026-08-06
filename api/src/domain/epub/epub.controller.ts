import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaService } from "../manga/manga.service.js";
import type { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { EpubService } from "./epub.service.js";

export const EpubApiGroupLive = HttpApiBuilder.group(Api, "epub", (handlers) =>
	Effect.gen(function* () {
		const epubService = yield* EpubService;
		const mangaService = yield* MangaService;

		function getManga(mangaId: AniListId) {
			return Effect.flatMap(CurrentUser, (user) =>
				mangaService.getManga(mangaId, user.id),
			);
		}

		return handlers
			.handle("createEpub", ({ path, payload }) =>
				Effect.gen(function* () {
					const user = yield* CurrentUser;
					const manga = yield* getManga(path.mangaId).pipe(
						Effect.catchAll(toHttpError),
					);
					return yield* epubService
						.requestGeneration(user, manga.id, path.provider, payload)
						.pipe(Effect.catchAll(toHttpError));
				}),
			)
			.handle("listEpubs", () =>
				Effect.flatMap(CurrentUser, (user) =>
					epubService.listForUser(user.id),
				).pipe(Effect.catchAll(toHttpError)),
			)
			.handle("downloadEpub", ({ path }) =>
				Effect.flatMap(CurrentUser, (user) =>
					epubService.getDownloadUrl(user, path.id),
				).pipe(
					Effect.map((url) => HttpServerResponse.redirect(url)),
					Effect.catchAll(toHttpError),
				),
			);
	}),
);
