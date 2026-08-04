import {
	boolean,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

export const permission = pgEnum("permission", [
	"MANGA_METADATA_REFRESH",
	"MANGA_PROVIDER_ADD",
	"MANGA_PROVIDER_REFRESH",
	"MANGA_PROVIDER_DELETE",
]);

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

export const userPermissions = pgTable(
	"user_permissions",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		permission: permission("permission").notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.permission] })],
);
