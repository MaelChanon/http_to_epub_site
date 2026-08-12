import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaProviderService } from "../mangaProvider/mangaProvider.service.js";
import { requirePermission } from "../user/permission.js";
import { MangaService } from "./manga.service.js";

export const MangaApiGroupLive = HttpApiBuilder.group(
	Api,
	"manga",
	(handlers) =>
		Effect.gen(function* () {
			const mangaService = yield* MangaService;
			const mangaProviderService = yield* MangaProviderService;

			return handlers
				.handle("listMangas", () =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						return yield* mangaService.listMangas(user.id);
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("searchManga", ({ urlParams }) =>
					Effect.gen(function* () {
						yield* CurrentUser;
						return yield* mangaProviderService.searchMedia(urlParams.q);
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("getManga", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						return yield* mangaService
							.getManga(path.mangaId, user.id)
							.pipe(
								Effect.catchTag("MangaNotFound", () =>
									mangaProviderService
										.fetchById(path.mangaId)
										.pipe(
											Effect.flatMap((data) =>
												mangaService.createManga(data, user.id),
											),
										),
								),
							);
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("getMangaCover", ({ path }) =>
					Effect.gen(function* () {
						yield* CurrentUser;
						const url = yield* mangaService.getCoverPresignedUrl(path.mangaId);
						return HttpServerResponse.redirect(url);
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("refreshManga", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requirePermission(user, "MANGA_METADATA_REFRESH");
						const data = yield* mangaProviderService
							.fetchById(path.mangaId)
							.pipe(Effect.catchAll(toHttpError));
						return yield* mangaService
							.createManga(data, user.id)
							.pipe(Effect.catchAll(toHttpError));
					}),
				)
				.handle("addFavorite", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						return yield* mangaService.addFavorite(path.mangaId, user.id);
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("removeFavorite", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						return yield* mangaService.removeFavorite(path.mangaId, user.id);
					}).pipe(Effect.catchAll(toHttpError)),
				);
		}),
);
