import { Data, Effect } from "effect";
import { SqlError } from "effect/sql";

export class SQLError extends Data.TaggedError("SQLError")<{
	message: string;
}> {
	get internalMessage() {
		return `SQL error : ${this.message}`;
	}
}

export const toSQLError = (e: unknown) =>
	new SQLError({ message: e instanceof Error ? e.message : String(e) });

/** Maps the `SqlError` a `db.transaction(...)` adds (begin/commit failures). */
export const catchSqlError = <A, E, R>(
	effect: Effect.Effect<A, E | SqlError.SqlError, R>,
) =>
	Effect.catchIf(effect, SqlError.isSqlError, (e) =>
		Effect.fail(toSQLError(e)),
	);

/** Takes the first row, or fails with `error` when there is none. */
export const getFirst =
	<E>(error: E) =>
	<T, E2, R>(effect: Effect.Effect<readonly T[], E2, R>) =>
		Effect.flatMap(effect, ([first]) =>
			first === undefined ? Effect.fail(error) : Effect.succeed(first),
		);
