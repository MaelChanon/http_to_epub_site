import { Config } from "effect";

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

class AppConfig {
	constructor(
		readonly host: string,
		readonly port: number,
		readonly databaseUrl: string,
		readonly sessionSecret: string,
		readonly sessionCookieName: string,
		readonly sessionTtlSeconds: number,
		readonly cookieSecure: boolean,
		readonly redisUrl: string,
	) {}
}
export const appConfig = Config.map(
	Config.all([
		Config.string("HOST").pipe(Config.withDefault("localhost")),
		Config.number("PORT").pipe(Config.withDefault(3000)),
		Config.string("DATABASE_URL").pipe(
			Config.withDefault(
				"postgres://user:secret@localhost:5432/mydatabasename",
			),
		),
		Config.string("SESSION_SECRET").pipe(
			Config.withDefault("dev-only-secret-change-me"),
		),
		Config.string("SESSION_COOKIE_NAME").pipe(Config.withDefault("session")),
		Config.number("SESSION_TTL_SECONDS").pipe(
			Config.withDefault(ONE_WEEK_IN_SECONDS),
		),
		Config.boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
		Config.string("REDIS_URL").pipe(
			Config.withDefault("redis://localhost:6379"),
		),
	]),
	([
		host,
		port,
		databaseUrl,
		sessionSecret,
		sessionCookieName,
		sessionTtlSeconds,
		cookieSecure,
		redisUrl,
	]) =>
		new AppConfig(
			host,
			port,
			databaseUrl,
			sessionSecret,
			sessionCookieName,
			sessionTtlSeconds,
			cookieSecure,
			redisUrl,
		),
);
