import { Config, Layer, Logger, References } from "effect";

const logLevelConfig = Config.LogLevel("LOG_LEVEL").pipe(
	Config.withDefault("Info"),
);

export const LoggerLive = Layer.mergeAll(
	Logger.layer([Logger.consolePretty()]),
	Layer.effect(References.MinimumLogLevel, logLevelConfig),
);
