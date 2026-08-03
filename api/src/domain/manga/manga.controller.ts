import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaProviderService } from "../mangaProvider/mangaProvider.service.js";
import { MangaService } from "./manga.service.js";

export const MangaApiGroupLive = HttpApiBuilder.group(
	Api,
	"manga",
	(handlers) =>
		Effect.gen(function* () {
			const mangaService = yield* MangaService;
			const mangaProviderService = yield* MangaProviderService;

			return handlers
				.handle("getManga", ({ path }) =>
					mangaService.getManga(path.mangaId).pipe(
						Effect.catchTag("MangaNotFound", () =>
							mangaProviderService
								.fetchById(path.mangaId)
								.pipe(Effect.flatMap(mangaService.createManga)),
						),
						Effect.catchAll(toHttpError),
					),
				)
				.handle("refreshManga", ({ path }) =>
					mangaProviderService
						.fetchById(path.mangaId)
						.pipe(
							Effect.flatMap(mangaService.createManga),
							Effect.catchAll(toHttpError),
						),
				);
		}),
);
