import {
	integer,
	pgTable,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { mangas } from "./mangas.js";

export const providers = pgTable("providers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull().unique(),
});

export const mangaProviders = pgTable(
	"manga_providers",
	{
		mangaId: uuid("manga_id")
			.notNull()
			.references(() => mangas.id, { onDelete: "cascade" }),
		providerId: uuid("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.mangaId, table.providerId] })],
);

export const chapters = pgTable(
	"chapters",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		mangaId: uuid("manga_id")
			.notNull()
			.references(() => mangas.id, { onDelete: "cascade" }),
		providerId: uuid("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "cascade" }),
		number: integer("number").notNull(),
	},
	(table) => [
		unique("chapters_manga_provider_number").on(
			table.mangaId,
			table.providerId,
			table.number,
		),
	],
);

export const pages = pgTable(
	"pages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		chapterId: uuid("chapter_id")
			.notNull()
			.references(() => chapters.id, { onDelete: "cascade" }),
		number: integer("number").notNull(),
		path: text("path").notNull(),
	},
	(table) => [unique("pages_chapter_number").on(table.chapterId, table.number)],
);
