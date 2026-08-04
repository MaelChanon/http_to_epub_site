import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { config as loadEnv } from "dotenv";
import { Effect, Layer } from "effect";

loadEnv({
	path: path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"../../.env",
	),
});

import { appConfig } from "./config.js";
import { ApiLive } from "./http/apiLive.js";
import { csrfProtection } from "./http/csrfProtection.js";
import { AppLayer } from "./layer.js";
import { LoggerLive } from "./log.js";

const server = Effect.gen(function* () {
	const config = yield* appConfig;

	const HttpLive = HttpApiBuilder.serve((httpApp) =>
		HttpMiddleware.logger(
			HttpMiddleware.cors({
				allowedOrigins: config.corsAllowedOrigins,
				credentials: true,
			})(csrfProtection(config.corsAllowedOrigins)(httpApp)),
		),
	).pipe(
		Layer.provide(ApiLive.pipe(Layer.provide(AppLayer))),
		Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
		Layer.provide(LoggerLive),
	);
	yield* Effect.logInfo(
		`Server listening on http://${config.host}:${config.port}`,
	);
	yield* Layer.launch(HttpLive);
});

NodeRuntime.runMain(server);
