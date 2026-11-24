import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { config as loadEnv } from "dotenv";
import { Effect, flow, identity, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/http";

loadEnv({
	path: path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"../../.env",
	),
});

import { appConfig } from "./config.js";
import { ApiLive } from "./http/apiLive.js";
import { csrfProtection } from "./http/csrfProtection.js";
import { EventsRoutesLive } from "./http/events.routes.js";
import { rateLimit } from "./http/rateLimit.js";
import { AppLayer } from "./layer.js";
import { LoggerLive } from "./log.js";

const HttpLive = Layer.unwrap(
	Effect.gen(function* () {
		const config = yield* appConfig;

		// Listed innermost first: CSRF checks run last, CORS headers first.
		const middleware = flow(
			csrfProtection(config.corsAllowedOrigins),
			rateLimit,
			config.trustProxy
				? HttpMiddleware.xForwardedHeaders({ trustedProxies: () => true })
				: identity,
			HttpMiddleware.cors({
				allowedOrigins: config.corsAllowedOrigins,
				credentials: true,
			}),
		);

		return HttpRouter.serve(Layer.mergeAll(ApiLive, EventsRoutesLive), {
			middleware,
		}).pipe(
			Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
		);
	}),
);

HttpLive.pipe(
	Layer.provide(AppLayer),
	Layer.provide(LoggerLive),
	Layer.launch,
	NodeRuntime.runMain,
);
