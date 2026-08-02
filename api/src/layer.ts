import { Layer } from "effect";
import { AuthService } from "./auth/auth.service.js";
import { DBLayer } from "./db.js";
import { EncryptService } from "./encrypt/encryptService.js";
import { MangaService } from "./manga/manga.service.js";
import { MangaProviderService } from "./manga/mangaProvider.service.js";
import { RedisClientLive } from "./redis.js";
import { S3Service } from "./s3/s3.service.js";
import { ProviderRepository } from "./scanProvider/provider.repository.js";
import { ProviderCatalogService } from "./scanProvider/providerCatalog.service.js";
import { ScanProviderCronLive } from "./scanProvider/scanProvider.cron.js";
import { ScanProviderService } from "./scanProvider/scanProvider.service.js";
import { SessionService } from "./session/session.service.js";
import { UsersRepository } from "./user/user.repository.js";
import { UserService } from "./user/user.service.js";

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
	ScanProviderService.Default,
	ProviderCatalogService.Default,
	UsersRepository.Default,
	ProviderRepository.Default,
);

const WorkersLive = ScanProviderCronLive.pipe(Layer.provide(ServicesLive));

export const AppLayer = Layer.mergeAll(ServicesLive, WorkersLive);
