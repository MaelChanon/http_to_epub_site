import { Context, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { appConfig } from "../../config.js";
import { makeS3Operations } from "./s3.ops.js";
import {
	S3Client,
	S3ClientLive,
	S3PresignClient,
	S3PresignClientLive,
} from "./s3Client.js";

export { ImageFetchFailed, S3Error, S3ObjectNotFound } from "./s3.ops.js";

const make = Effect.gen(function* () {
	const client = yield* S3Client;
	const presignClient = yield* S3PresignClient;
	const config = yield* appConfig;
	const httpClient = yield* HttpClient.HttpClient;

	const forBucket = (bucket: string) =>
		makeS3Operations(client, presignClient, bucket, httpClient);

	return {
		manga: forBucket(config.s3Bucket),
		user: forBucket(config.s3UserBucket),
	};
});

export class S3Service extends Context.Service<S3Service>()("api/S3Service", {
	make,
}) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([S3ClientLive, S3PresignClientLive, FetchHttpClient.layer]),
	);
}
