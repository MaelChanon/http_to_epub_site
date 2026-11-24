import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaProviderService } from "../mangaProvider/mangaProvider.service.js";
import { requirePermission } from "../user/permission.js";
import { MangaService } from "./manga.service.js";

export const MangaApiGroupLive = HttpApiBuilder.group(
	Api,
	"manga",
	Effect.fn(function* (handlers) {
		const mangaService = yield* MangaService;
		const mangaProviderService = yield* MangaProviderService;

		return handlers.handleAll({
			listMangas: Effect.fn(function* () {
				const user = yield* CurrentUser;
				return yield* mangaService.listMangas(user.id);
			}, Effect.catch(toHttpError)),

			searchManga: ({ query }) =>
				mangaProviderService
					.searchMedia(query.q)
					.pipe(Effect.catch(toHttpError)),

			// First visit of a manga: import it from AniList.
			getManga: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				return yield* mangaService
					.getManga(params.mangaId, user.id)
					.pipe(
						Effect.catchTag("MangaNotFound", () =>
							mangaProviderService
								.fetchById(params.mangaId)
								.pipe(
									Effect.flatMap((data) =>
										mangaService.createManga(data, user.id),
									),
								),
						),
					);
			}, Effect.catch(toHttpError)),

			getMangaCover: Effect.fn(function* ({ params }) {
				const url = yield* mangaService.getCoverPresignedUrl(params.mangaId);
				return HttpServerResponse.redirect(url);
			}, Effect.catch(toHttpError)),

			refreshManga: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				yield* requirePermission(user, "MANGA_METADATA_REFRESH");
				const data = yield* mangaProviderService.fetchById(params.mangaId);
				return yield* mangaService.createManga(data, user.id);
			}, Effect.catch(toHttpError)),

			addFavorite: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				return yield* mangaService.addFavorite(params.mangaId, user.id);
			}, Effect.catch(toHttpError)),

			removeFavorite: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				return yield* mangaService.removeFavorite(params.mangaId, user.id);
			}, Effect.catch(toHttpError)),
		});
	}),
);
