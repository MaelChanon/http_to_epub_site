import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { mangas } from "./mangas.js";
import { users } from "./users.js";

export const favorites = pgTable(
	"favorites",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		mangaId: uuid("manga_id")
			.notNull()
			.references(() => mangas.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.mangaId] })],
);
