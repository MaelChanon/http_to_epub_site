import * as http from "node:http";
import * as https from "node:https";
import { S3Client as S3ClientSdk } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { appConfig } from "../../config.js";

export class S3Client extends Context.Tag("S3Client")<
	S3Client,
	S3ClientSdk
>() {}

export class S3PresignClient extends Context.Tag("S3PresignClient")<
	S3PresignClient,
	S3ClientSdk
>() {}

function acquireS3Client(config: {
	readonly s3Endpoint: string;
	readonly s3Region: string;
	readonly s3ForcePathStyle: boolean;
	readonly s3AccessKeyId: string;
	readonly s3SecretAccessKey: string;
}) {
	return Effect.acquireRelease(
		Effect.sync(
			() =>
				new S3ClientSdk({
					endpoint: config.s3Endpoint,
					region: config.s3Region,
					forcePathStyle: config.s3ForcePathStyle,
					credentials: {
						accessKeyId: config.s3AccessKeyId,
						secretAccessKey: config.s3SecretAccessKey,
					},
					requestHandler: new NodeHttpHandler({
						httpAgent: new http.Agent({ keepAlive: false }),
						httpsAgent: new https.Agent({ keepAlive: false }),
					}),
				}),
		),
		(client) => Effect.sync(() => client.destroy()),
	);
}

export const S3ClientLive = Layer.scoped(
	S3Client,
	Effect.gen(function* () {
		const config = yield* appConfig;
		return yield* acquireS3Client(config);
	}),
);

export const S3PresignClientLive = Layer.scoped(
	S3PresignClient,
	Effect.gen(function* () {
		const config = yield* appConfig;
		return yield* acquireS3Client({
			...config,
			s3Endpoint: config.s3PublicEndpoint,
		});
	}),
);
