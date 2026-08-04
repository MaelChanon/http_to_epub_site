import { Config } from "effect";

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

class AppConfig {
	constructor(
		readonly host: string,
		readonly port: number,
		readonly databaseUrl: string,
		readonly sessionCookieName: string,
		readonly sessionTtlSeconds: number,
		readonly cookieSecure: boolean,
		readonly redisUrl: string,
		readonly s3Endpoint: string,
		readonly s3Region: string,
		readonly s3Bucket: string,
		readonly s3AccessKeyId: string,
		readonly s3SecretAccessKey: string,
		readonly s3ForcePathStyle: boolean,
		readonly corsAllowedOrigins: readonly string[],
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
		Config.string("SESSION_COOKIE_NAME").pipe(Config.withDefault("session")),
		Config.number("SESSION_TTL_SECONDS").pipe(
			Config.withDefault(ONE_WEEK_IN_SECONDS),
		),
		Config.boolean("COOKIE_SECURE").pipe(Config.withDefault(true)),
		Config.string("REDIS_URL").pipe(
			Config.withDefault("redis://localhost:6379"),
		),
		Config.string("S3_ENDPOINT").pipe(
			Config.withDefault("http://localhost:3900"),
		),
		Config.string("S3_REGION").pipe(Config.withDefault("garage")),
		Config.string("S3_BUCKET").pipe(Config.withDefault("manga")),
		Config.string("S3_ACCESS_KEY_ID").pipe(Config.withDefault("")),
		Config.string("S3_SECRET_ACCESS_KEY").pipe(Config.withDefault("")),
		Config.boolean("S3_FORCE_PATH_STYLE").pipe(Config.withDefault(true)),
		Config.string("CORS_ALLOWED_ORIGINS").pipe(
			Config.withDefault("http://localhost:5173"),
		),
	]),
	([
		host,
		port,
		databaseUrl,
		sessionCookieName,
		sessionTtlSeconds,
		cookieSecure,
		redisUrl,
		s3Endpoint,
		s3Region,
		s3Bucket,
		s3AccessKeyId,
		s3SecretAccessKey,
		s3ForcePathStyle,
		corsAllowedOrigins,
	]) =>
		new AppConfig(
			host,
			port,
			databaseUrl,
			sessionCookieName,
			sessionTtlSeconds,
			cookieSecure,
			redisUrl,
			s3Endpoint,
			s3Region,
			s3Bucket,
			s3AccessKeyId,
			s3SecretAccessKey,
			s3ForcePathStyle,
			corsAllowedOrigins
				.split(",")
				.map((origin) => origin.trim())
				.filter((origin) => origin.length > 0),
		),
);
