import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaService } from "../manga/manga.service.js";
import type { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { requirePermission } from "../user/permission.js";
import { ProviderCatalogService } from "./providerCatalog.service.js";
import { ScanProviderService } from "./scanProvider.service.js";

export const ScanProviderApiGroupLive = HttpApiBuilder.group(
	Api,
	"scanProvider",
	(handlers) =>
		Effect.gen(function* () {
			const mangaService = yield* MangaService;
			const scanProviderService = yield* ScanProviderService;
			const providerCatalogService = yield* ProviderCatalogService;

			function getManga(mangaId: AniListId) {
				return Effect.flatMap(CurrentUser, (user) =>
					mangaService.getManga(mangaId, user.id),
				);
			}

			return handlers
				.handle("syncMangaChapters", ({ path, payload }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						const manga = yield* getManga(path.mangaId).pipe(
							Effect.catchAll(toHttpError),
						);
						const alreadyLinked = yield* scanProviderService
							.hasMangaProviderLink(manga.id, payload.provider)
							.pipe(Effect.catchAll(toHttpError));
						yield* requirePermission(
							user,
							alreadyLinked ? "MANGA_PROVIDER_REFRESH" : "MANGA_PROVIDER_ADD",
						);
						yield* scanProviderService
							.syncMangaChapters(manga.id, payload.slug, payload.provider)
							.pipe(Effect.catchAll(toHttpError));
					}),
				)
				.handle("getMangaProviders", ({ path }) =>
					getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.listMangaProviders(manga.id),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviderChapters", ({ path }) =>
					getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.listChapterNumbers(manga.id, path.provider),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviderChapterPages", ({ path }) =>
					getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.getChapterPages(
								manga.id,
								path.mangaId,
								path.provider,
								path.number,
							),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviderChapterPage", ({ path }) =>
					getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.getChapterPagePresignedUrl(
								manga.id,
								path.provider,
								path.number,
								path.pageIndex,
							),
						),
						Effect.map((url) => HttpServerResponse.redirect(url)),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("searchProviderCatalog", ({ path, urlParams }) =>
					providerCatalogService
						.search(path.provider, urlParams.q)
						.pipe(Effect.catchAll(toHttpError)),
				)
				.handle("deleteMangaProviderChapters", ({ path }) =>
					Effect.gen(function* () {
						const user = yield* CurrentUser;
						yield* requirePermission(user, "MANGA_PROVIDER_DELETE");
						const manga = yield* getManga(path.mangaId).pipe(
							Effect.catchAll(toHttpError),
						);
						yield* scanProviderService
							.deleteMangaProviderChapters(manga.id, path.provider)
							.pipe(Effect.catchAll(toHttpError));
					}),
				)
				.handle("buildMangaProviderArchive", ({ path }) =>
					getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.buildProviderArchive(manga.id, path.provider),
						),
						Effect.catchAll(toHttpError),
					),
				);
		}),
);
