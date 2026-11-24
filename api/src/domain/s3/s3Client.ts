import * as http from "node:http";
import * as https from "node:https";
import { S3Client as S3ClientSdk } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Context, Effect, Layer } from "effect";
import { appConfig } from "../../config.js";

export class S3Client extends Context.Service<S3Client, S3ClientSdk>()(
	"S3Client",
) {}

export class S3PresignClient extends Context.Service<
	S3PresignClient,
	S3ClientSdk
>()("S3PresignClient") {}

/** `endpoint` is the internal one for `S3Client`, the public one for presigned URLs. */
const acquireS3Client = (endpoint: "s3Endpoint" | "s3PublicEndpoint") =>
	Effect.gen(function* () {
		const config = yield* appConfig;
		const makeClient = () =>
			new S3ClientSdk({
				endpoint: config[endpoint],
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
			});
		return yield* Effect.acquireRelease(Effect.sync(makeClient), (client) =>
			Effect.sync(() => client.destroy()),
		);
	});

export const S3ClientLive = Layer.effect(
	S3Client,
	acquireS3Client("s3Endpoint"),
);

export const S3PresignClientLive = Layer.effect(
	S3PresignClient,
	acquireS3Client("s3PublicEndpoint"),
);
