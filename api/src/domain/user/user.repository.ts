import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import { DB, DBLayer } from "../../../drizzle/db.js";
import { users } from "../../../drizzle/schema/users.js";
import {
	getFirst,
	SQLError,
	toSQLError,
} from "../../../drizzle/schema/utils.js";
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

			function toUser(row: typeof users.$inferSelect) {
				return new User({
					id: UserId.make(row.id),
					pseudo: row.pseudo,
					email: row.email,
					isAdmin: row.isAdmin,
				});
			}

			function toUserWithPassword(row: typeof users.$inferSelect) {
				return new UserWithPassword({
					id: UserId.make(row.id),
					pseudo: row.pseudo,
					email: row.email,
					password: row.password,
					isAdmin: row.isAdmin,
				});
			}

			function create(data: {
				pseudo: string;
				email: string;
				password: string;
			}) {
				return Effect.gen(function* () {
					const user = yield* db
						.insert(users)
						.values(data)
						.returning()
						.pipe(
							Effect.mapError(toSQLError),
							getFirst(new SQLError({ message: "failed to create user" })),
						);
					return toUser(user);
				});
			}

			function getById(id: UserId) {
				return Effect.gen(function* () {
					const [row] = yield* db
						.select()
						.from(users)
						.where(eq(users.id, id))
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
					const [row] = yield* db
						.select()
						.from(users)
						.where(eq(users.email, email))
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
					const [row] = yield* db
						.select()
						.from(users)
						.where(eq(users.email, email))
						.pipe(Effect.mapError(toSQLError));
					if (!row) {
						return yield* Effect.fail(
							new UserNotFound({ field: "email", value: email }),
						);
					}
					return toUserWithPassword(row);
				});
			}

			return {
				create,
				getById,
				getByEmail,
				getByEmailWithPassword,
			} as const;
		}),
		dependencies: [DBLayer],
	},
) {}
