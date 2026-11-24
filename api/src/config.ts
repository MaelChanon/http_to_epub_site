import * as os from "node:os";
import * as path from "node:path";
import { Config } from "effect";

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;
const TWO_DAYS_IN_SECONDS = 60 * 60 * 24 * 2;
const ONE_HOUR_IN_SECONDS = 60 * 60;
const TWENTY_FIVE_MINUTES_IN_SECONDS = 25 * 60;
const DEFAULT_EPUB_OUTPUT_DIR = path.join(
	os.tmpdir(),
	"http-to-epub-site",
	"epub-build",
);

const string = (name: string, fallback: string) =>
	Config.String(name).pipe(Config.withDefault(fallback));

const trimmed = (name: string, fallback: string) =>
	string(name, fallback).pipe(Config.map((value) => value.trim()));

const number = (name: string, fallback: number) =>
	Config.Number(name).pipe(Config.withDefault(fallback));

const boolean = (name: string, fallback: boolean) =>
	Config.Boolean(name).pipe(Config.withDefault(fallback));

const s3Endpoint = string("S3_ENDPOINT", "http://localhost:3900");

const corsAllowedOrigins = string(
	"CORS_ALLOWED_ORIGINS",
	"http://localhost:5173",
).pipe(
	Config.map((origins) =>
		origins
			.split(",")
			.map((origin) => origin.trim())
			.filter((origin) => origin.length > 0),
	),
);

export const appConfig = Config.all({
	host: string("HOST", "localhost"),
	port: number("PORT", 3000),
	databaseUrl: string(
		"DATABASE_URL",
		"postgres://user:secret@localhost:5432/mydatabasename",
	),
	sessionTtlSeconds: number("SESSION_TTL_SECONDS", ONE_WEEK_IN_SECONDS),
	cookieSecure: boolean("COOKIE_SECURE", true),
	redisUrl: string("REDIS_URL", "redis://localhost:6379"),
	s3Endpoint,
	s3PublicEndpoint: Config.String("S3_PUBLIC_ENDPOINT").pipe(
		Config.orElse(() => s3Endpoint),
	),
	s3Region: string("S3_REGION", "garage"),
	s3Bucket: string("S3_BUCKET", "manga"),
	s3UserBucket: string("S3_USER_BUCKET", "user"),
	s3AccessKeyId: string("S3_ACCESS_KEY_ID", ""),
	s3SecretAccessKey: string("S3_SECRET_ACCESS_KEY", ""),
	s3ForcePathStyle: boolean("S3_FORCE_PATH_STYLE", true),
	corsAllowedOrigins,
	trustProxy: boolean("TRUST_PROXY", false),
	disableAnilistFetching: boolean("DISABLE_ANILIST_FETCHING", false),
	epubOutputDir: string("EPUB_OUTPUT_DIR", DEFAULT_EPUB_OUTPUT_DIR),
	inviteTtlSeconds: number("INVITE_TTL_SECONDS", TWO_DAYS_IN_SECONDS),
	passwordResetTtlSeconds: number(
		"PASSWORD_RESET_TTL_SECONDS",
		ONE_HOUR_IN_SECONDS,
	),
	// Empty disables the solver: a Cloudflare challenge then fails the sync.
	flaresolverrUrl: trimmed("FLARESOLVERR_URL", "http://localhost:8191/v1"),
	cfClearanceTtlSeconds: number(
		"CF_CLEARANCE_TTL_SECONDS",
		TWENTY_FIVE_MINUTES_IN_SECONDS,
	),
	// Empty = direct. Needed when anime-sama bans the server's IP.
	animeSamaProxyUrl: trimmed("ANIME_SAMA_PROXY_URL", ""),
});
