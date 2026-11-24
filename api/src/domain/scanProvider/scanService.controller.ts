import { Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { CurrentUser } from "../../auth/auth.middleware.js";
import { Api, ProviderArchive } from "../../http/api.js";
import { toHttpError } from "../../http/error.js";
import { MangaService } from "../manga/manga.service.js";
import type { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { S3Service } from "../s3/s3.service.js";
import { requirePermission } from "../user/permission.js";
import { ProviderCatalogService } from "./providerCatalog.service.js";
import { ScanProviderService } from "./scanProvider.service.js";

export const ScanProviderApiGroupLive = HttpApiBuilder.group(
	Api,
	"scanProvider",
	Effect.fn(function* (handlers) {
		const mangaService = yield* MangaService;
		const scanProviderService = yield* ScanProviderService;
		const providerCatalogService = yield* ProviderCatalogService;
		const s3 = yield* S3Service;

		const getManga = Effect.fn(function* (mangaId: AniListId) {
			const user = yield* CurrentUser;
			return yield* mangaService.getManga(mangaId, user.id);
		});

		return handlers.handleAll({
			syncMangaChapters: Effect.fn(function* ({ params, payload }) {
				const user = yield* CurrentUser;
				const manga = yield* getManga(params.mangaId);
				const alreadyLinked = yield* scanProviderService.hasMangaProviderLink(
					manga.id,
					payload.provider,
				);
				yield* requirePermission(
					user,
					alreadyLinked ? "MANGA_PROVIDER_REFRESH" : "MANGA_PROVIDER_ADD",
				);
				yield* scanProviderService.syncMangaChapters(
					manga.id,
					payload.slug,
					payload.provider,
					!alreadyLinked,
				);
			}, Effect.catch(toHttpError)),

			getMangaProviders: Effect.fn(function* ({ params }) {
				const manga = yield* getManga(params.mangaId);
				return yield* scanProviderService.listMangaProviders(manga.id);
			}, Effect.catch(toHttpError)),

			getMangaProviderChapters: Effect.fn(function* ({ params }) {
				const manga = yield* getManga(params.mangaId);
				return yield* scanProviderService.listChapterNumbers(
					manga.id,
					params.provider,
				);
			}, Effect.catch(toHttpError)),

			getMangaProviderChapterPages: Effect.fn(function* ({ params }) {
				const manga = yield* getManga(params.mangaId);
				return yield* scanProviderService.getChapterPages(
					manga.id,
					params.mangaId,
					params.provider,
					params.number,
				);
			}, Effect.catch(toHttpError)),

			getMangaProviderChapterPage: Effect.fn(function* ({ params }) {
				const manga = yield* getManga(params.mangaId);
				const url = yield* scanProviderService.getChapterPagePresignedUrl(
					manga.id,
					params.provider,
					params.number,
					params.pageNumber,
				);
				return HttpServerResponse.redirect(url);
			}, Effect.catch(toHttpError)),

			searchProviderCatalog: ({ params, query }) =>
				providerCatalogService
					.search(params.provider, query.q)
					.pipe(Effect.catch(toHttpError)),

			deleteMangaProviderChapters: Effect.fn(function* ({ params }) {
				const user = yield* CurrentUser;
				yield* requirePermission(user, "MANGA_PROVIDER_DELETE");
				const manga = yield* getManga(params.mangaId);
				yield* scanProviderService.deleteMangaProviderChapters(
					manga.id,
					params.provider,
				);
			}, Effect.catch(toHttpError)),

			getMangaProviderArchive: Effect.fn(function* ({ params }) {
				const manga = yield* getManga(params.mangaId);
				const key = scanProviderService.getProviderArchive(
					manga.id,
					params.provider,
				);
				const url = yield* s3.manga.getUrl(key);
				return new ProviderArchive({ url });
			}, Effect.catch(toHttpError)),
		});
	}),
);
