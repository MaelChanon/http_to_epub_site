import { Readable } from "node:stream";
import { Context, Data, Effect, Layer } from "effect";
import { Zip, ZipPassThrough } from "fflate";

export class ArchiveError extends Data.TaggedError("ArchiveError")<{
	readonly message: string;
}> {
	get internalMessage() {
		return `Archive error: ${this.message}`;
	}
}

export interface ZipStream {
	readonly readable: Readable;
	readonly addEntry: (
		entryName: string,
		data: Uint8Array,
	) => Effect.Effect<void, ArchiveError>;
	readonly end: () => Effect.Effect<void, ArchiveError>;
	readonly abort: (cause: Error) => void;
}

function createZipStream(): ZipStream {
	let releaseDrain: (() => void) | null = null;
	let backpressured = false;
	let failure: ArchiveError | null = null;

	const release = () => {
		const resume = releaseDrain;
		releaseDrain = null;
		resume?.();
	};

	const readable = new Readable({
		highWaterMark: 1024 * 1024,
		read() {
			backpressured = false;
			release();
		},
	});

	readable.on("error", release);
	readable.on("close", release);

	const zip = new Zip((error, chunk, final) => {
		if (error) {
			failure = new ArchiveError({ message: error.message });
			readable.destroy(failure);
			return;
		}

		if (chunk.length > 0 && !readable.push(Buffer.from(chunk))) {
			backpressured = true;
		}

		if (final) {
			readable.push(null);
		}
	});

	const drain = () =>
		backpressured && !readable.destroyed
			? new Promise<void>((resolve) => {
					releaseDrain = resolve;
				})
			: Promise.resolve();

	const toArchiveError = (e: unknown) =>
		e instanceof ArchiveError
			? e
			: new ArchiveError({
					message: e instanceof Error ? e.message : String(e),
				});

	const addEntry = (entryName: string, data: Uint8Array) =>
		Effect.tryPromise({
			try: async () => {
				const file = new ZipPassThrough(entryName);
				zip.add(file);
				file.push(data, true);
				await drain();

				if (failure) {
					throw failure;
				}
				if (readable.destroyed) {
					throw new ArchiveError({
						message: `archive stream closed before ${entryName} was written`,
					});
				}
			},
			catch: toArchiveError,
		});

	const end = () =>
		Effect.try({
			try: () => zip.end(),
			catch: toArchiveError,
		});

	const abort = (cause: Error) => {
		if (!readable.destroyed) {
			readable.destroy(cause);
		}
	};

	return { readable, addEntry, end, abort };
}

export class ArchiveService extends Context.Service<
	ArchiveService,
	{ readonly createZipStream: typeof createZipStream }
>()("api/ArchiveService") {
	static readonly Default = Layer.succeed(this, { createZipStream });
}
