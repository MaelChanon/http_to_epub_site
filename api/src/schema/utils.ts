import { Data, Effect, Option } from "effect";

export class SQLError extends Data.TaggedError("SQLError")<{
	message: string;
}> {
	get internalMessage() {
		return `SQL error : ${this.message}`;
	}
}

export const toSQLError = (e: unknown) =>
	new SQLError({ message: e instanceof Error ? e.message : String(e) });

export const getFirst = <R>(error: R) =>
	Effect.fn("getFirst")(<T, E, Ctx>(effect: Effect.Effect<T[], E, Ctx>) =>
		effect.pipe(
			Effect.andThen((array) =>
				Option.fromNullable(array[0]).pipe(
					Option.match({
						onNone: () => Effect.fail(error),
						onSome: Effect.succeed,
					}),
				),
			),
		),
	);
