import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { mangas } from "./mangas.js";
import { providers } from "./providers.js";
import { users } from "./users.js";

export const epubStatus = pgEnum("epub_status", [
	"PENDING",
	"PROCESSING",
	"DONE",
	"FAILED",
]);

export const epubs = pgTable("epubs", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	mangaId: uuid("manga_id")
		.notNull()
		.references(() => mangas.id, { onDelete: "cascade" }),
	providerId: uuid("provider_id")
		.notNull()
		.references(() => providers.id, { onDelete: "cascade" }),
	chapterStart: integer("chapter_start").notNull(),
	chapterEnd: integer("chapter_end").notNull(),
	width: integer("width").notNull(),
	height: integer("height").notNull(),
	splitDoublePage: boolean("split_double_page").notNull().default(false),
	creator: text("creator").notNull(),
	filename: text("filename").notNull(),
	s3Key: text("s3_key").notNull(),
	status: epubStatus("status").notNull().default("PENDING"),
	fileSizeBytes: integer("file_size_bytes"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
