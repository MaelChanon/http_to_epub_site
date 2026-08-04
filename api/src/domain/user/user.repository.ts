import { eq, count as sqlCount } from "drizzle-orm";
import { Data, Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { userPermissions, users } from "../../../drizzle/schema/users.js";
import {
	getFirst,
	SQLError,
	toSQLError,
} from "../../../drizzle/schema/utils.js";
import type { Permission } from "./permission.js";
import { User, UserId, UserWithPassword } from "./user.domain.js";

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
	readonly field: string;
	readonly value: string;
}> {
	get internalMessage() {
		return `User with ${this.field}=${this.value} not found`;
	}
}

export class UsersRepository extends Effect.Service<UsersRepository>()(
	"api/UsersRepository",
	{
		effect: Effect.gen(function* () {
			const db = yield* DB;

			type UserRow = NonNullable<
				Effect.Effect.Success<
					ReturnType<
						typeof db.query.users.findFirst<{
							with: { permissions: true };
						}>
					>
				>
			>;

			function toUser(row: UserRow) {
				return new User({
					id: UserId.make(row.id),
					pseudo: row.pseudo,
					email: row.email,
					isAdmin: row.isAdmin,
					permissions: row.permissions.map((p) => p.permission),
				});
			}

			function toUserWithPassword(row: UserRow) {
				return new UserWithPassword({
					id: UserId.make(row.id),
					pseudo: row.pseudo,
					email: row.email,
					password: row.password,
					isAdmin: row.isAdmin,
					permissions: row.permissions.map((p) => p.permission),
				});
			}

			function create(data: {
				pseudo: string;
				email: string;
				password: string;
				permissions: readonly Permission[];
			}) {
				return db
					.transaction((tx) =>
						Effect.gen(function* () {
							const user = yield* tx
								.insert(users)
								.values({
									pseudo: data.pseudo,
									email: data.email,
									password: data.password,
								})
								.returning()
								.pipe(
									Effect.mapError(toSQLError),
									getFirst(new SQLError({ message: "failed to create user" })),
								);

							if (data.permissions.length > 0) {
								yield* tx
									.insert(userPermissions)
									.values(
										data.permissions.map((permission) => ({
											userId: user.id,
											permission,
										})),
									)
									.pipe(Effect.mapError(toSQLError));
							}

							return new User({
								id: UserId.make(user.id),
								pseudo: user.pseudo,
								email: user.email,
								isAdmin: user.isAdmin,
								permissions: data.permissions,
							});
						}),
					)
					.pipe(Effect.catchTag("SqlError", toSQLError));
			}

			function getById(id: UserId) {
				return Effect.gen(function* () {
					const row = yield* db.query.users
						.findFirst({ where: { id }, with: { permissions: true } })
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* Effect.fail(
							new UserNotFound({ field: "id", value: id }),
						);
					}
					return toUser(row);
				});
			}

			function getByEmail(email: string) {
				return Effect.gen(function* () {
					const row = yield* db.query.users
						.findFirst({ where: { email }, with: { permissions: true } })
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* Effect.fail(
							new UserNotFound({ field: "email", value: email }),
						);
					}
					return toUser(row);
				});
			}

			function getByEmailWithPassword(email: string) {
				return Effect.gen(function* () {
					const row = yield* db.query.users
						.findFirst({ where: { email }, with: { permissions: true } })
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* Effect.fail(
							new UserNotFound({ field: "email", value: email }),
						);
					}
					return toUserWithPassword(row);
				});
			}

			function count() {
				return db
					.select({ total: sqlCount() })
					.from(users)
					.pipe(
						Effect.mapError(toSQLError),
						Effect.map((rows) => rows[0]?.total ?? 0),
					);
			}

			function listNonAdmin() {
				return Effect.gen(function* () {
					const rows = yield* db.query.users
						.findMany({
							where: { isAdmin: false },
							with: { permissions: true },
						})
						.pipe(Effect.mapError(toSQLError));
					return rows.map(toUser);
				});
			}

			function setPermissions(id: UserId, permissions: readonly Permission[]) {
				return db
					.transaction((tx) =>
						Effect.gen(function* () {
							yield* tx
								.delete(userPermissions)
								.where(eq(userPermissions.userId, id))
								.pipe(Effect.mapError(toSQLError));

							if (permissions.length > 0) {
								yield* tx
									.insert(userPermissions)
									.values(
										permissions.map((permission) => ({
											userId: id,
											permission,
										})),
									)
									.pipe(Effect.mapError(toSQLError));
							}

							const row = yield* tx.query.users
								.findFirst({ where: { id }, with: { permissions: true } })
								.pipe(Effect.mapError(toSQLError));
							if (!row) {
								return yield* Effect.fail(
									new UserNotFound({ field: "id", value: id }),
								);
							}
							return toUser(row);
						}),
					)
					.pipe(Effect.catchTag("SqlError", toSQLError));
			}

			function deleteUser(id: UserId) {
				return db
					.delete(users)
					.where(eq(users.id, id))
					.pipe(Effect.mapError(toSQLError), Effect.asVoid);
			}

			return {
				create,
				getById,
				getByEmail,
				getByEmailWithPassword,
				count,
				listNonAdmin,
				setPermissions,
				deleteUser,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
