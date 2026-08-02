import { boolean, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		pseudo: text("pseudo").notNull(),
		email: text("email").notNull(),
		password: text("password").notNull(),
		isAdmin: boolean("is_admin").notNull().default(false),
	},
	(table) => [unique().on(table.email)],
);
