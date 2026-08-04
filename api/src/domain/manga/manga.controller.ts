import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { FavoriteService } from "../favorite/favorite.service.js";
import { MangaProviderService } from "../mangaProvider/mangaProvider.service.js";
import { requirePermission } from "../user/permission.js";
import { Manga } from "./manga.domain.js";
import { MangaService } from "./manga.service.js";

export const MangaApiGroupLive = HttpApiBuilder.group(
	Api,
	"manga",
	(handlers) =>
		Effect.gen(function* () {
			const mangaService = yield* MangaService;
			const mangaProviderService = yield* MangaProviderService;
			const favoriteService = yield* FavoriteService;

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
						const manga = yield* mangaService.getManga(path.mangaId, user.id);
						yield* favoriteService.add(user.id, manga.id);
						return new Manga({ ...manga, isFavorite: true });
					}).pipe(Effect.catchAll(toHttpError)),
				)
				.handle("removeFavorite", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						const manga = yield* mangaService.getManga(path.mangaId, user.id);
						yield* favoriteService.remove(user.id, manga.id);
						return new Manga({ ...manga, isFavorite: false });
					}).pipe(Effect.catchAll(toHttpError)),
				);
		}),
);
