import { Layer } from "effect";
import { DBLayer } from "../drizzle/db.js";
import { AuthService } from "./auth/auth.service.js";
import { FavoriteService } from "./domain/favorite/favorite.service.js";
import { MangaService } from "./domain/manga/manga.service.js";
import { MangaProviderService } from "./domain/mangaProvider/mangaProvider.service.js";
import { S3Service } from "./domain/s3/s3.service.js";
import { ProviderRepository } from "./domain/scanProvider/provider.repository.js";
import { ProviderCatalogService } from "./domain/scanProvider/providerCatalog.service.js";
import { ScanEventsService } from "./domain/scanProvider/scanEvents.service.js";
import { ScanProviderCronLive } from "./domain/scanProvider/scanProvider.cron.js";
import { ScanProviderService } from "./domain/scanProvider/scanProvider.service.js";
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
	MangaService.Default,
	FavoriteService.Default,
	ScanProviderService.Default,
	ScanEventsService.Default,
	ProviderCatalogService.Default,
	UsersRepository.Default,
	ProviderRepository.Default,
);

const WorkersLive = ScanProviderCronLive.pipe(Layer.provide(ServicesLive));

export const AppLayer = Layer.mergeAll(ServicesLive, WorkersLive);
