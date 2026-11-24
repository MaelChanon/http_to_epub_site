import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import { appConfig } from "../src/config.js";
import { relations } from "./schema/relations.js";

const PgClientLive = Layer.unwrap(
	Effect.map(appConfig, (config) =>
		PgClient.layer({ url: Redacted.make(config.databaseUrl) }),
	),
);

const makeDb = PgDrizzle.makeWithDefaults({ relations });

export class DB extends Context.Service<DB, Effect.Success<typeof makeDb>>()(
	"DB",
) {}

export const DBLayer = Layer.effect(DB, makeDb).pipe(
	Layer.provideMerge(PgClientLive),
);
