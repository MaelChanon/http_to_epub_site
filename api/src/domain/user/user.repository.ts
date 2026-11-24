import { eq, count as sqlCount } from "drizzle-orm";
import { Context, Data, Effect, Layer } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { userPermissions, users } from "../../../drizzle/schema/users.js";
import {
	catchSqlError,
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

interface UserRow {
	readonly id: string;
	readonly pseudo: string;
	readonly email: string;
	readonly password: string;
	readonly isAdmin: boolean;
	readonly permissions: readonly { readonly permission: Permission }[];
}

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
	return new UserWithPassword({ ...toUser(row), password: row.password });
}

const make = Effect.gen(function* () {
	const db = yield* DB;

	const findBy = Effect.fn("UsersRepository.findBy")(function* (
		field: "id" | "email",
		value: string,
	) {
		const row = yield* db.query.users
			.findFirst({ where: { [field]: value }, with: { permissions: true } })
			.pipe(Effect.mapError(toSQLError));
		if (!row) {
			return yield* new UserNotFound({ field, value });
		}
		return row;
	});

	const create = (data: {
		pseudo: string;
		email: string;
		password: string;
		permissions: readonly Permission[];
		isAdmin: boolean;
	}) =>
		db
			.transaction(
				Effect.fn(function* (tx) {
					const user = yield* tx
						.insert(users)
						.values({
							pseudo: data.pseudo,
							email: data.email,
							password: data.password,
							isAdmin: data.isAdmin,
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
			.pipe(catchSqlError);

	const count = () =>
		db
			.select({ total: sqlCount() })
			.from(users)
			.pipe(
				Effect.mapError(toSQLError),
				Effect.map((rows) => rows[0]?.total ?? 0),
			);

	const listNonAdmin = () =>
		db.query.users
			.findMany({ where: { isAdmin: false }, with: { permissions: true } })
			.pipe(
				Effect.mapError(toSQLError),
				Effect.map((rows) => rows.map(toUser)),
			);

	const setPermissions = (id: UserId, permissions: readonly Permission[]) =>
		db
			.transaction(
				Effect.fn(function* (tx) {
					yield* tx
						.delete(userPermissions)
						.where(eq(userPermissions.userId, id))
						.pipe(Effect.mapError(toSQLError));

					if (permissions.length > 0) {
						yield* tx
							.insert(userPermissions)
							.values(
								permissions.map((permission) => ({ userId: id, permission })),
							)
							.pipe(Effect.mapError(toSQLError));
					}

					const row = yield* tx.query.users
						.findFirst({ where: { id }, with: { permissions: true } })
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* new UserNotFound({ field: "id", value: id });
					}
					return toUser(row);
				}),
			)
			.pipe(catchSqlError);

	const updatePassword = (id: UserId, password: string) =>
		db
			.update(users)
			.set({ password })
			.where(eq(users.id, id))
			.pipe(Effect.mapError(toSQLError), Effect.asVoid);

	const deleteUser = (id: UserId) =>
		db
			.delete(users)
			.where(eq(users.id, id))
			.pipe(Effect.mapError(toSQLError), Effect.asVoid);

	return {
		create,
		getById: (id: UserId) => Effect.map(findBy("id", id), toUser),
		getByEmail: (email: string) => Effect.map(findBy("email", email), toUser),
		getByEmailWithPassword: (email: string) =>
			Effect.map(findBy("email", email), toUserWithPassword),
		count,
		listNonAdmin,
		setPermissions,
		updatePassword,
		deleteUser,
	};
});

export class UsersRepository extends Context.Service<UsersRepository>()(
	"api/UsersRepository",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide(DBLayer),
	);
}
