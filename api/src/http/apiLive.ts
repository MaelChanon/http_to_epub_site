import { HttpApiBuilder } from "@effect/platform";
import { Layer } from "effect";
import { AuthenticationLive } from "../auth/auth.middleware.live.js";
import { EpubApiGroupLive } from "../domain/epub/epub.controller.js";
import { MangaApiGroupLive } from "../domain/manga/manga.controller.js";
import { ScanProviderApiGroupLive } from "../domain/scanProvider/scanService.controller.js";
import {
	AuthApiGroupLive,
	UsersApiGroupLive,
} from "../domain/user/user.controller.js";
import { Api } from "./api.js";

export { Api } from "./api.js";

export const ApiLive = HttpApiBuilder.api(Api).pipe(
	Layer.provide(
		Layer.mergeAll(
			UsersApiGroupLive,
			AuthApiGroupLive,
			MangaApiGroupLive,
			ScanProviderApiGroupLive,
			EpubApiGroupLive,
		),
	),
	Layer.provide(AuthenticationLive),
);
