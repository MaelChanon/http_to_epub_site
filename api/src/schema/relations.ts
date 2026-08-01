import { defineRelations } from "drizzle-orm";
import * as schema from "./users.js";

export const relations = defineRelations(schema);
