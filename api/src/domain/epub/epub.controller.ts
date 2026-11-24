import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaService } from "../manga/manga.service.js";
import { EpubService } from "./epub.service.js";

export const EpubApiGroupLive = HttpApiBuilder.group(
	Api,
	"epub",
	Effect.fn(function* (handlers) {
		const epubService = yield* EpubService;
		const mangaService = yield* MangaService;

		return handlers.handleAll({
			createEpub: Effect.fn(function* ({ params, payload }) {
				const user = yield* CurrentUser;
				const manga = yield* mangaService.getManga(params.mangaId, user.id);
				return yield* epubService.requestGeneration(
					user,
					manga.id,
					params.provider,
					payload,
				);
			}, Effect.catch(toHttpError)),

			listEpubs: Effect.fn(function* () {
				const user = yield* CurrentUser;
				return yield* epubService.listForUser(user.id);
			}, Effect.catch(toHttpError)),

			downloadEpub: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				const url = yield* epubService.getDownloadUrl(user, params.id);
				return HttpServerResponse.redirect(url);
			}, Effect.catch(toHttpError)),

			deleteEpub: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				yield* epubService.deleteEpub(user, params.id);
			}, Effect.catch(toHttpError)),
		});
	}),
);
