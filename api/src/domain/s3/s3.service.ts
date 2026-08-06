import { FetchHttpClient, HttpClient } from "@effect/platform";
import { Effect } from "effect";
import { appConfig } from "../../config.js";
import { makeS3Operations } from "./s3.ops.js";
import { S3Client, S3ClientLive } from "./s3Client.js";

export { ImageFetchFailed, S3Error, S3ObjectNotFound } from "./s3.ops.js";

export class S3Service extends Effect.Service<S3Service>()("api/S3Service", {
	effect: Effect.gen(function* () {
		const client = yield* S3Client;
		const config = yield* appConfig;
		const httpClient = yield* HttpClient.HttpClient;

		const forBucket = (bucket: string) =>
			makeS3Operations(client, bucket, httpClient);

		return {
			manga: forBucket(config.s3Bucket),
			user: forBucket(config.s3UserBucket),
		};
	}),
	dependencies: [S3ClientLive, FetchHttpClient.layer],
}) {}
