import { Config, Effect, Layer, Logger, LogLevel } from "effect";

const logLevelConfig = Config.logLevel("LOG_LEVEL").pipe(
	Config.withDefault(LogLevel.Info),
);

export const LoggerLive = Layer.unwrapEffect(
	Effect.map(logLevelConfig, (level) =>
		Layer.merge(Logger.pretty, Logger.minimumLogLevel(level)),
	),
);
