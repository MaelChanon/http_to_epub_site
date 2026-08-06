import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Cause, Data, Effect, Exit, Option } from "effect";
import { appConfig } from "../../config.js";
import { MangaDbId } from "../manga/manga.domain.js";
import { MangaRepository } from "../manga/manga.repository.js";
import { MangaFetcherService } from "../mangaFetcher/mangaFetcher.service.js";
import { AniListId } from "../mangaProvider/mangaProvider.domain.js";
import { S3Service } from "../s3/s3.service.js";
import { ProviderRepository } from "../scanProvider/provider.repository.js";
import type { MangaProviderName } from "../scanProvider/scanProvider.domain.js";
import { ScanProviderRepository } from "../scanProvider/scanProvider.repository.js";
import { MangaProviderNotLinked } from "../scanProvider/scanProvider.service.js";
import type { User } from "../user/user.domain.js";
import {
	type CreateEpubPayload,
	EpubId,
	type EpubStatus,
	MangaEpubs,
} from "./epub.domain.js";
import { sanitizeFilename } from "./epub.filename.js";
import { EpubRepository } from "./epub.repository.js";

const INTERNAL_PRESIGN_TTL_SECONDS = 6 * 60 * 60;

export class EpubNotFound extends Data.TaggedError("EpubNotFound")<{
	readonly id: EpubId;
}> {
	get internalMessage() {
		return `Epub with id=${this.id} not found`;
	}
}

export class EpubNotReady extends Data.TaggedError("EpubNotReady")<{
	readonly id: EpubId;
	readonly status: EpubStatus;
}> {
	get internalMessage() {
		return `Epub ${this.id} is not ready for download (status=${this.status})`;
	}
}

export class EpubChapterRangeEmpty extends Data.TaggedError(
	"EpubChapterRangeEmpty",
)<{
	readonly mangaId: MangaDbId;
	readonly provider: MangaProviderName;
	readonly chapterStart: number;
	readonly chapterEnd: number;
}> {
	get internalMessage() {
		return `No chapters found for manga=${this.mangaId} provider=${this.provider} in range [${this.chapterStart}, ${this.chapterEnd}]`;
	}
}

export class EpubFileReadFailed extends Data.TaggedError("EpubFileReadFailed")<{
	readonly path: string;
	readonly cause: unknown;
}> {
	get internalMessage() {
		const reason =
			this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `failed to read generated epub file at ${this.path}: ${reason}`;
	}
}

export class EpubService extends Effect.Service<EpubService>()(
	"api/EpubService",
	{
		effect: Effect.gen(function* () {
			const config = yield* appConfig;
			const epubRepo = yield* EpubRepository;
			const mangaRepo = yield* MangaRepository;
			const providerRepo = yield* ProviderRepository;
			const scanProviderRepo = yield* ScanProviderRepository;
			const s3 = yield* S3Service;
			const mangaFetcher = yield* MangaFetcherService;

			function generate(epubId: string) {
				return Effect.gen(function* () {
					const row = yield* epubRepo.findById(epubId);
					if (!row) {
						return yield* Effect.logError(
							`epub ${epubId} not found when starting generation`,
						);
					}

					yield* epubRepo.markProcessing(epubId);

					const work = Effect.gen(function* () {
						const chapterRows = yield* scanProviderRepo.findChaptersInRange(
							MangaDbId.make(row.mangaId),
							row.providerId,
							row.chapterStart,
							row.chapterEnd,
						);

						const chapterInputs = yield* Effect.forEach(
							chapterRows,
							(chapter) =>
								Effect.gen(function* () {
									const sortedPages = chapter.pages
										.slice()
										.sort((a, b) => a.number - b.number);
									const pageUrls = yield* Effect.forEach(
										sortedPages,
										(page) =>
											s3.manga.getUrl(page.path, INTERNAL_PRESIGN_TTL_SECONDS),
										{ concurrency: 5 },
									);
									return { chapterNumber: chapter.number, pages: pageUrls };
								}),
						);

						const coverUrl = yield* s3.manga.getUrl(
							row.manga.path,
							INTERNAL_PRESIGN_TTL_SECONDS,
						);

						const outputPath = path.join(
							config.epubOutputDir,
							`${epubId}.epub`,
						);

						return yield* Effect.gen(function* () {
							const built = yield* mangaFetcher.buildEpub({
								tag: String(row.manga.mangaId),
								name: row.manga.titleNative,
								coverUrl,
								creator: row.creator,
								lang: "fr-FR",
								width: row.width,
								height: row.height,
								splitDoublePage: row.splitDoublePage,
								chapters: chapterInputs,
								outputPath,
							});

							const bytes = yield* Effect.tryPromise({
								try: () => fs.readFile(outputPath),
								catch: (cause) =>
									new EpubFileReadFailed({ path: outputPath, cause }),
							});

							yield* s3.user.upload(row.s3Key, bytes, "application/epub+zip");

							return built.fileSizeBytes;
						}).pipe(
							Effect.ensuring(
								Effect.promise(() => fs.rm(outputPath, { force: true })),
							),
						);
					});

					yield* work.pipe(
						Effect.onExit((exit) =>
							Exit.match(exit, {
								onSuccess: (value) => epubRepo.markDone(epubId, value),
								onFailure: (cause) =>
									Effect.logError(
										`epub generation failed for ${epubId}: ${Cause.pretty(cause)}`,
									).pipe(Effect.andThen(epubRepo.markFailed(epubId))),
							}).pipe(
								Effect.catchAllCause((cause) =>
									Effect.logError(
										`failed to persist epub status for ${epubId}: ${cause}`,
									),
								),
							),
						),
					);
				});
			}

			function requestGeneration(
				user: User,
				mangaDbId: MangaDbId,
				provider: MangaProviderName,
				payload: CreateEpubPayload,
			) {
				return Effect.gen(function* () {
					const providerIdOpt =
						yield* providerRepo.findProviderIdByName(provider);
					if (Option.isNone(providerIdOpt)) {
						return yield* Effect.fail(
							new MangaProviderNotLinked({ mangaId: mangaDbId, provider }),
						);
					}
					const providerId = providerIdOpt.value;

					const chapterRows = yield* scanProviderRepo.findChaptersInRange(
						mangaDbId,
						providerId,
						payload.chapterStart,
						payload.chapterEnd,
					);
					if (chapterRows.length === 0) {
						return yield* Effect.fail(
							new EpubChapterRangeEmpty({
								mangaId: mangaDbId,
								provider,
								chapterStart: payload.chapterStart,
								chapterEnd: payload.chapterEnd,
							}),
						);
					}

					const id = crypto.randomUUID();
					const filename = sanitizeFilename(payload.filename);
					const s3Key = `${user.id}/${mangaDbId}/${provider}/${id}.epub`;
					const creator = payload.creator?.trim() || user.pseudo;

					yield* epubRepo.insertPending({
						id,
						userId: user.id,
						mangaId: mangaDbId,
						providerId,
						chapterStart: payload.chapterStart,
						chapterEnd: payload.chapterEnd,
						width: payload.width,
						height: payload.height,
						splitDoublePage: payload.splitDoublePage,
						creator,
						filename,
						s3Key,
					});

					yield* Effect.forkDaemon(
						generate(id).pipe(
							Effect.catchAllCause((cause) =>
								Effect.logError(`epub generation failed for ${id}: ${cause}`),
							),
						),
					);

					const row = yield* epubRepo.findById(id);
					if (!row) {
						return yield* Effect.fail(
							new EpubNotFound({ id: EpubId.make(id) }),
						);
					}
					return epubRepo.toEpub(row);
				});
			}

			function listForUser(userId: User["id"]) {
				return Effect.gen(function* () {
					const mangas = yield* mangaRepo.listWithEpubsForUser(userId);

					return mangas
						.filter((manga) => manga.epubs.length > 0)
						.map(
							(manga) =>
								new MangaEpubs({
									mangaId: AniListId.make(manga.mangaId),
									mangaTitle:
										manga.titleRomaji ??
										manga.titleEnglish ??
										manga.titleNative,
									mangaCoverUrl: `/api/manga/${manga.mangaId}/cover`,
									epubs: manga.epubs.map(epubRepo.toEpub),
								}),
						)
						.sort(
							(a, b) =>
								(b.epubs[0]?.createdAt.getTime() ?? 0) -
								(a.epubs[0]?.createdAt.getTime() ?? 0),
						);
				});
			}

			function getDownloadUrl(user: User, epubId: string) {
				return Effect.gen(function* () {
					const row = yield* epubRepo.findById(epubId);
					if (!row || row.userId !== user.id) {
						return yield* Effect.fail(
							new EpubNotFound({ id: EpubId.make(epubId) }),
						);
					}
					if (row.status !== "DONE") {
						return yield* Effect.fail(
							new EpubNotReady({ id: EpubId.make(epubId), status: row.status }),
						);
					}

					return yield* s3.user.getUrl(
						row.s3Key,
						undefined,
						`attachment; filename="${row.filename}.epub"`,
					);
				});
			}

			return {
				requestGeneration,
				listForUser,
				getDownloadUrl,
			} as const;
		}),
		dependencies: [
			EpubRepository.Default,
			MangaRepository.Default,
			ProviderRepository.Default,
			ScanProviderRepository.Default,
			S3Service.Default,
			MangaFetcherService.Default,
		],
	},
) {}
