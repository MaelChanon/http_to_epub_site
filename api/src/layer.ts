import { Effect, Layer } from "effect";
import { AuthService } from "./auth/auth.service.js";
import { appConfig } from "./config.js";
import { DBLayer } from "./db.js";
import { EncryptService } from "./encrypt/encryptService.js";
import { MangaService } from "./manga/manga.service.js";
import { MangaProviderService } from "./manga/mangaProvider.service.js";
import { RedisClientLive } from "./redis.js";
import { S3Service } from "./s3/s3.service.js";
import { SessionService } from "./session/session.service.js";
import { UserService } from "./user/user.service.js";

const selectLayers = Effect.gen(function* () {
	yield* appConfig;

	return Layer.mergeAll(
		AuthService.Default,
		DBLayer,
		RedisClientLive,
		EncryptService.Default,
		UserService.Default,
		SessionService.Default,
		S3Service.Default,
		MangaProviderService.Default,
		MangaService.Default,
	);
});

export const AppLayer = Layer.unwrapEffect(selectLayers);
