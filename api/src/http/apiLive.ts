import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { AuthApiGroupLive } from "../auth/auth.controller.js";
import { AuthenticationLive } from "../auth/auth.middleware.live.js";
import { EpubApiGroupLive } from "../domain/epub/epub.controller.js";
import { MangaApiGroupLive } from "../domain/manga/manga.controller.js";
import { ScanProviderApiGroupLive } from "../domain/scanProvider/scanService.controller.js";
import { UsersApiGroupLive } from "../domain/user/user.controller.js";
import { Api } from "./api.js";

export { Api } from "./api.js";

export const ApiLive = HttpApiBuilder.layer(Api).pipe(
	Layer.provide([
		UsersApiGroupLive,
		AuthApiGroupLive,
		MangaApiGroupLive,
		ScanProviderApiGroupLive,
		EpubApiGroupLive,
	]),
	Layer.provide(AuthenticationLive),
);
