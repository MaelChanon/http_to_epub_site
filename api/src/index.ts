import { createServer } from "node:http";
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect, Layer } from "effect";
import { ApiLive } from "./apiLive.js";
import { appConfig } from "./config.js";
import { AppLayer } from "./layer.js";
import { LoggerLive } from "./log.js";

const server = Effect.gen(function* () {
	const config = yield* appConfig;

	const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
		Layer.provide(ApiLive.pipe(Layer.provide(AppLayer))),
		Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
		Layer.provide(LoggerLive),
	);
	yield* Effect.logInfo(
		`Server listening on http://${config.host}:${config.port}`,
	);
	Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
});

Effect.runPromise(server);
