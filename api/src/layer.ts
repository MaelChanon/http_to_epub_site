import { Layer } from "effect";
import { DBLayer } from "../drizzle/db.js";
import { AuthService } from "./auth/auth.service.js";
import { EpubCronLive } from "./domain/epub/epub.cron.js";
import { EpubRepository } from "./domain/epub/epub.repository.js";
import { EpubService } from "./domain/epub/epub.service.js";
import { MangaRepository } from "./domain/manga/manga.repository.js";
import { MangaService } from "./domain/manga/manga.service.js";
import { MangaProviderService } from "./domain/mangaProvider/mangaProvider.service.js";
import { S3Service } from "./domain/s3/s3.service.js";
import { ProviderRepository } from "./domain/scanProvider/provider.repository.js";
import { ProviderCatalogService } from "./domain/scanProvider/providerCatalog.service.js";
import { ScanEventsService } from "./domain/scanProvider/scanEvents.service.js";
import { ScanProviderCronLive } from "./domain/scanProvider/scanProvider.cron.js";
import { ScanProviderRepository } from "./domain/scanProvider/scanProvider.repository.js";
import { ScanProviderService } from "./domain/scanProvider/scanProvider.service.js";
import { BootstrapInviteLive } from "./domain/user/bootstrapInvite.js";
import { MagicLinkService } from "./domain/user/magicLink.service.js";
import { UsersRepository } from "./domain/user/user.repository.js";
import { UserService } from "./domain/user/user.service.js";
import { EncryptService } from "./encrypt/encryptService.js";
import { RedisClientLive } from "./redis.js";
import { SessionService } from "./session/session.service.js";

const ServicesLive = Layer.mergeAll(
	AuthService.Default,
	DBLayer,
	RedisClientLive,
	EncryptService.Default,
	UserService.Default,
	SessionService.Default,
	S3Service.Default,
	MangaProviderService.Default,
	MangaRepository.Default,
	MangaService.Default,
	ScanProviderService.Default,
	ScanEventsService.Default,
	ProviderCatalogService.Default,
	UsersRepository.Default,
	ProviderRepository.Default,
	ScanProviderRepository.Default,
	EpubRepository.Default,
	EpubService.Default,
	MagicLinkService.Default,
);

const WorkersLive = Layer.mergeAll(
	ScanProviderCronLive,
	EpubCronLive,
	BootstrapInviteLive,
).pipe(Layer.provide(ServicesLive));

export const AppLayer = Layer.mergeAll(ServicesLive, WorkersLive);
