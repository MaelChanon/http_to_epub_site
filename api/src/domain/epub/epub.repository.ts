import { and, eq, inArray, lt } from "drizzle-orm";
import { Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { epubs } from "../../../drizzle/schema/epub.js";
import { toSQLError } from "../../../drizzle/schema/utils.js";
import type { MangaDbId } from "../manga/manga.domain.js";
import type { MangaProviderName } from "../scanProvider/scanProvider.domain.js";
import { Epub, EpubId, type EpubStatus } from "./epub.domain.js";

type InsertEpubParams = Omit<typeof epubs.$inferInsert, "mangaId"> & {
	mangaId: MangaDbId;
};

export class EpubRepository extends Effect.Service<EpubRepository>()(
	"api/EpubRepository",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;

			function insert(params: InsertEpubParams) {
				return db
					.insert(epubs)
					.values(params)
					.pipe(Effect.mapError(toSQLError));
			}

			function updateStatus(
				id: string,
				data:
					| { status: EpubStatus }
					| { status: "DONE"; fileSizeBytes: number },
			) {
				return db
					.update(epubs)
					.set({ ...data, updatedAt: new Date() })
					.where(eq(epubs.id, id))
					.pipe(Effect.mapError(toSQLError));
			}

			function findById(id: string) {
				return db.query.epubs
					.findFirst({
						where: { id },
						with: { manga: true, provider: true },
					})
					.pipe(Effect.mapError(toSQLError));
			}

			function failStale(olderThan: Date) {
				return db
					.update(epubs)
					.set({
						status: "FAILED",
						updatedAt: new Date(),
					})
					.where(
						and(
							inArray(epubs.status, ["PENDING", "PROCESSING"]),
							lt(epubs.updatedAt, olderThan),
						),
					)
					.pipe(Effect.mapError(toSQLError));
			}

			function toEpub(row: {
				readonly id: string;
				readonly provider: { readonly name: MangaProviderName };
				readonly chapterStart: number;
				readonly chapterEnd: number;
				readonly width: number;
				readonly height: number;
				readonly splitDoublePage: boolean;
				readonly creator: string;
				readonly filename: string;
				readonly status: EpubStatus;
				readonly fileSizeBytes: number | null;
				readonly createdAt: Date;
			}) {
				return new Epub({
					id: EpubId.make(row.id),
					provider: row.provider.name,
					chapterStart: row.chapterStart,
					chapterEnd: row.chapterEnd,
					width: row.width,
					height: row.height,
					splitDoublePage: row.splitDoublePage,
					creator: row.creator,
					filename: row.filename,
					status: row.status,
					downloadUrl:
						row.status === "DONE" ? `/api/epub/${row.id}/download` : null,
					fileSizeBytes: row.fileSizeBytes,
					createdAt: row.createdAt,
				});
			}

			return {
				toEpub,
				insert,
				updateStatus,
				findById,
				failStale,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
