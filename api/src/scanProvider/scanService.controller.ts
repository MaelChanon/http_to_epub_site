import { HttpApiBuilder } from "@effect/platform";
import { Effect } from "effect";
import { Api } from "../api.js";
import { toHttpError } from "../error.js";
import { MangaService } from "../manga/manga.service.js";
import { ScanProviderService } from "./scanProvider.service.js";

export const ScanProviderApiGroupLive = HttpApiBuilder.group(
	Api,
	"scanProvider",
	(handlers) =>
		Effect.gen(function* () {
			const mangaService = yield* MangaService;
			const scanProviderService = yield* ScanProviderService;

			return handlers.handle("syncMangaChapters", ({ path, payload }) =>
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
			);
		}),
);
