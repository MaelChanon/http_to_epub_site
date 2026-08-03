import { Data, Effect } from "effect";
import { zipSync } from "fflate";

export class ArchiveError extends Data.TaggedError("ArchiveError")<{
	readonly message: string;
}> {
	get internalMessage() {
		return `Archive error: ${this.message}`;
	}
}

export interface ArchiveEntry {
	readonly entryName: string;
	readonly data: Uint8Array;
}

export class ArchiveService extends Effect.Service<ArchiveService>()(
	"api/ArchiveService",
	{
		effect: Effect.gen(function* () {
			function buildZip(entries: readonly ArchiveEntry[]) {
				return Effect.try({
					try: () =>
						zipSync(
							Object.fromEntries(
								entries.map(
									({ entryName, data }) => [entryName, data] as const,
								),
							),
						),
					catch: (e) =>
						new ArchiveError({
							message: e instanceof Error ? e.message : String(e),
						}),
				});
			}

			return { buildZip } as const;
		}),
	},
) {}
