import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { Effect } from "effect";
import { appConfig } from "./src/config.js";

const config = Effect.runSync(appConfig);

export default defineConfig({
  out: "./drizzle",
  schema: "./drizzle/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: config.databaseUrl,
  },
  strict: true,
  verbose: true,
});