import {
	date,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";

export const mangaFormat = pgEnum("manga_format", [
	"SERIES",
	"ONE_SHOT",
	"NOVEL",
]);

export const mangaStatus = pgEnum("manga_status", [
	"ONGOING",
	"FINISHED",
	"CANCELLED",
	"HIATUS",
	"NOT_YET_RELEASED",
]);

export const mangaGenre = pgEnum("manga_genre", [
	"ACTION",
	"ADVENTURE",
	"COMEDY",
	"DRAMA",
	"ECCHI",
	"FANTASY",
	"HENTAI",
	"HORROR",
	"MAHOU_SHOUJO",
	"MECHA",
	"MUSIC",
	"MYSTERY",
	"PSYCHOLOGICAL",
	"ROMANCE",
	"SCI_FI",
	"SLICE_OF_LIFE",
	"SPORTS",
	"SUPERNATURAL",
	"THRILLER",
]);

export const mangas = pgTable("mangas", {
	id: uuid("id").primaryKey().defaultRandom(),
	mangaId: integer("manga_id").notNull().unique(),
	path: text("path").notNull(),
	titleRomaji: text("title_romaji"),
	titleEnglish: text("title_english"),
	titleNative: text("title_native").notNull(),
	format: mangaFormat("format").notNull(),
	status: mangaStatus("status").notNull(),
	publishedAt: date("published_at", { mode: "date" }),
	totalChapters: integer("total_chapters"),
	score: integer("score"),
	summary: text("summary"),
});

export const mangaStaff = pgTable("manga_staff", {
	id: uuid("id").primaryKey().defaultRandom(),
	mangaId: uuid("manga_id")
		.notNull()
		.references(() => mangas.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	role: text("role").notNull(),
});

export const mangaGenres = pgTable(
	"manga_genres",
	{
		mangaId: uuid("manga_id")
			.notNull()
			.references(() => mangas.id, { onDelete: "cascade" }),
		genre: mangaGenre("genre").notNull(),
	},
	(table) => [primaryKey({ columns: [table.mangaId, table.genre] })],
);
