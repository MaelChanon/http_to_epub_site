import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { types } from "pg";
import { appConfig } from "../src/config.js";
import { relations } from "./schema/relations.js";

const pgClientLive = Effect.gen(function* () {
	const config = yield* appConfig;
	return PgClient.layer({
		url: Redacted.make(config.databaseUrl),
		types: {
			getTypeParser: (typeId, format) => {
				if (
					[1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(
						typeId,
					)
				) {
					return (val: string) => val;
				}
				return types.getTypeParser(typeId, format);
			},
		},
	});
});
export const PgClientLive = Layer.unwrapEffect(pgClientLive);

const dbEffect = PgDrizzle.make({ relations }).pipe(
	Effect.provide(PgDrizzle.DefaultServices),
);

export class DB extends Context.Tag("DB")<
	DB,
	Effect.Effect.Success<typeof dbEffect>
>() {}

const DBLive = Layer.effect(
	DB,
	Effect.gen(function* () {
		return yield* dbEffect;
	}),
);

export const DBLayer = Layer.provideMerge(DBLive, PgClientLive);
