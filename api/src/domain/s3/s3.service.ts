import {
	GetObjectCommand,
	ListObjectsV2Command,
	NoSuchKey,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientResponse,
} from "@effect/platform";
import { Data, Effect, Schedule } from "effect";
import { appConfig } from "../../config.js";
import { S3Client, S3ClientLive } from "./s3Client.js";

export class S3ObjectNotFound extends Data.TaggedError("S3ObjectNotFound")<{
	readonly key: string;
}> {
	get internalMessage() {
		return `S3 object not found: ${this.key}`;
	}
}

export class S3Error extends Data.TaggedError("S3Error")<{
	readonly operation: string;
	readonly message: string;
}> {
	get internalMessage() {
		return `S3 error during ${this.operation}: ${this.message}`;
	}
}

export class ImageFetchFailed extends Data.TaggedError("ImageFetchFailed")<{
	readonly url: string;
	readonly message: string;
}> {
	get internalMessage() {
		return `Failed to fetch image at ${this.url}: ${this.message}`;
	}
}

const uploadRetrySchedule = Schedule.exponential("200 millis").pipe(
	Schedule.intersect(Schedule.recurs(4)),
);

const toS3Error = (operation: string) => (e: unknown) =>
	new S3Error({
		operation,
		message: e instanceof Error ? e.message : String(e),
	});

export class S3Service extends Effect.Service<S3Service>()("api/S3Service", {
	effect: Effect.gen(function* () {
		const client = yield* S3Client;
		const config = yield* appConfig;
		const httpClient = yield* HttpClient.HttpClient;

		function upload(key: string, body: Uint8Array, contentType?: string) {
			return Effect.tryPromise({
				try: () =>
					client.send(
						new PutObjectCommand({
							Bucket: config.s3Bucket,
							Key: key,
							Body: body,
							ContentType: contentType,
						}),
					),
				catch: toS3Error("upload"),
			}).pipe(Effect.asVoid);
		}

		function getUrl(key: string, expiresInSeconds = 3600) {
			return Effect.tryPromise({
				try: () =>
					getSignedUrl(
						client,
						new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }),
						{ expiresIn: expiresInSeconds },
					),
				catch: toS3Error("getUrl"),
			});
		}

		function download(key: string) {
			return Effect.gen(function* () {
				const response = yield* Effect.tryPromise({
					try: () =>
						client.send(
							new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }),
						),
					catch: (e) =>
						e instanceof NoSuchKey
							? new S3ObjectNotFound({ key })
							: toS3Error("download")(e),
				});

				const body = response.Body;
				if (!body) {
					return yield* Effect.fail(new S3ObjectNotFound({ key }));
				}

				return yield* Effect.tryPromise({
					try: () => body.transformToByteArray(),
					catch: toS3Error("download"),
				});
			});
		}

		function list(prefix = "") {
			return Effect.gen(function* () {
				const response = yield* Effect.tryPromise({
					try: () =>
						client.send(
							new ListObjectsV2Command({
								Bucket: config.s3Bucket,
								Prefix: prefix,
								Delimiter: "/",
							}),
						),
					catch: toS3Error("list"),
				});

				return {
					files: (response.Contents ?? [])
						.map((object) => object.Key)
						.filter((key) => key !== undefined),
					folders: (response.CommonPrefixes ?? [])
						.map((commonPrefix) => commonPrefix.Prefix)
						.filter((prefix) => prefix !== undefined),
				};
			});
		}

		function fetchAndUpload(key: string, url: string) {
			return Effect.gen(function* () {
				const response = yield* httpClient.get(url).pipe(
					Effect.flatMap(HttpClientResponse.filterStatusOk),
					Effect.mapError(
						(error) => new ImageFetchFailed({ url, message: error.message }),
					),
				);

				const bytes = yield* response.arrayBuffer.pipe(
					Effect.mapError(
						(error) => new ImageFetchFailed({ url, message: error.message }),
					),
				);

				yield* upload(
					key,
					new Uint8Array(bytes),
					response.headers["content-type"],
				).pipe(Effect.retry(uploadRetrySchedule));
			});
		}

		return { upload, download, list, getUrl, fetchAndUpload } as const;
	}),
	dependencies: [S3ClientLive, FetchHttpClient.layer],
}) {}
