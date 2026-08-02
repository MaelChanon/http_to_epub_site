import {
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { mangas } from "./mangas.js";

export const providerName = pgEnum("provider_name", [
	"SUSHISCAN",
	"MANGA_ORIGINS",
]);

export const providers = pgTable("providers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: providerName("name").notNull().unique(),
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
		tag: text("tag"),
	},
	(table) => [primaryKey({ columns: [table.mangaId, table.providerId] })],
);

export const providerMangas = pgTable(
	"provider_mangas",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		providerId: uuid("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
		name: text("name").notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("provider_mangas_provider_tag").on(table.providerId, table.tag),
	],
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
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
