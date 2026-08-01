import { HttpApiBuilder } from "@effect/platform";
import { Layer } from "effect";
import { Api } from "./api.js";
import { AuthenticationLive } from "./auth/auth.middleware.live.js";
import { AuthApiGroupLive, UsersApiGroupLive } from "./user/user.controller.js";

export { Api } from "./api.js";

export const ApiLive = HttpApiBuilder.api(Api).pipe(
	Layer.provide(Layer.mergeAll(UsersApiGroupLive, AuthApiGroupLive)),
	Layer.provide(AuthenticationLive),
);
