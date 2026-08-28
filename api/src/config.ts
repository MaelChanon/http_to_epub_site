import * as os from "node:os";
import * as path from "node:path";
import { Config } from "effect";

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;
const TWO_DAYS_IN_SECONDS = 60 * 60 * 24 * 2;
const ONE_HOUR_IN_SECONDS = 60 * 60;
const DEFAULT_EPUB_OUTPUT_DIR = path.join(
	os.tmpdir(),
	"http-to-epub-site",
	"epub-build",
);

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
		readonly s3PublicEndpoint: string,
		readonly s3Region: string,
		readonly s3Bucket: string,
		readonly s3UserBucket: string,
		readonly s3AccessKeyId: string,
		readonly s3SecretAccessKey: string,
		readonly s3ForcePathStyle: boolean,
		readonly corsAllowedOrigins: readonly string[],
		readonly trustProxy: boolean,
		readonly disableAnilistFetching: boolean,
		readonly epubOutputDir: string,
		readonly inviteTtlSeconds: number,
		readonly passwordResetTtlSeconds: number,
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
		Config.string("S3_PUBLIC_ENDPOINT").pipe(
			Config.orElse(() =>
				Config.string("S3_ENDPOINT").pipe(
					Config.withDefault("http://localhost:3900"),
				),
			),
		),
		Config.string("S3_REGION").pipe(Config.withDefault("garage")),
		Config.string("S3_BUCKET").pipe(Config.withDefault("manga")),
		Config.string("S3_USER_BUCKET").pipe(Config.withDefault("user")),
		Config.string("S3_ACCESS_KEY_ID").pipe(Config.withDefault("")),
		Config.string("S3_SECRET_ACCESS_KEY").pipe(Config.withDefault("")),
		Config.boolean("S3_FORCE_PATH_STYLE").pipe(Config.withDefault(true)),
		Config.string("CORS_ALLOWED_ORIGINS").pipe(
			Config.withDefault("http://localhost:5173"),
		),
		Config.boolean("TRUST_PROXY").pipe(Config.withDefault(false)),
		Config.boolean("DISABLE_ANILIST_FETCHING").pipe(Config.withDefault(false)),
		Config.string("EPUB_OUTPUT_DIR").pipe(
			Config.withDefault(DEFAULT_EPUB_OUTPUT_DIR),
		),
		Config.number("INVITE_TTL_SECONDS").pipe(
			Config.withDefault(TWO_DAYS_IN_SECONDS),
		),
		Config.number("PASSWORD_RESET_TTL_SECONDS").pipe(
			Config.withDefault(ONE_HOUR_IN_SECONDS),
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
		s3PublicEndpoint,
		s3Region,
		s3Bucket,
		s3UserBucket,
		s3AccessKeyId,
		s3SecretAccessKey,
		s3ForcePathStyle,
		corsAllowedOrigins,
		trustProxy,
		disableAnilistFetching,
		epubOutputDir,
		inviteTtlSeconds,
		passwordResetTtlSeconds,
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
			s3PublicEndpoint,
			s3Region,
			s3Bucket,
			s3UserBucket,
			s3AccessKeyId,
			s3SecretAccessKey,
			s3ForcePathStyle,
			corsAllowedOrigins
				.split(",")
				.map((origin) => origin.trim())
				.filter((origin) => origin.length > 0),
			trustProxy,
			disableAnilistFetching,
			epubOutputDir,
			inviteTtlSeconds,
			passwordResetTtlSeconds,
		),
);
