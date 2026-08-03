import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaService } from "../manga/manga.service.js";
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

			return handlers
				.handle("syncMangaChapters", ({ path, payload }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.syncMangaChapters(
								manga.id,
								payload.slug,
								payload.provider,
							),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviders", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.listMangaProviders(manga.id),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviderChapters", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.listChapterNumbers(manga.id, path.provider),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("getMangaProviderChapterPages", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.getChapterPages(
								manga.id,
								path.provider,
								path.number,
							),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("searchProviderCatalog", ({ path, urlParams }) =>
					providerCatalogService
						.search(path.provider, urlParams.q)
						.pipe(Effect.catchAll(toHttpError)),
				)
				.handle("deleteMangaProviderChapters", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.deleteMangaProviderChapters(
								manga.id,
								path.provider,
							),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("buildMangaProviderArchive", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.flatMap((manga) =>
							scanProviderService.buildProviderArchive(manga.id, path.provider),
						),
						Effect.catchAll(toHttpError),
					),
				);
		}),
);
