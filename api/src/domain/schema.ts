import { Schema } from "effect";

/** A string that has no surrounding whitespace and is not empty. */
export const NonEmptyTrimmedString = Schema.Trimmed.check(Schema.isNonEmpty());

export const UUID = Schema.String.check(Schema.isUUID());
