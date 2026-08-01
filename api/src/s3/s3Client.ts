import { S3Client as S3ClientSdk } from "@aws-sdk/client-s3";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { appConfig } from "../config.js";

export class S3Client extends Context.Tag("S3Client")<
	S3Client,
	S3ClientSdk
>() {}

const s3ClientEffect = Effect.gen(function* () {
	const config = yield* appConfig;
	return yield* Effect.acquireRelease(
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
				}),
		),
		(client) => Effect.sync(() => client.destroy()),
	);
});

export const S3ClientLive = Layer.scoped(S3Client, s3ClientEffect);
