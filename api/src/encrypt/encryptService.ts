import * as bcrypt from "bcryptjs";
import { Context, Data, Effect, Layer } from "effect";

const SALT_ROUNDS = 12;

export const DUMMY_PASSWORD_HASH =
	"$2b$12$h.PNKYQ98bl3OUQvByyQo.xQYugu3XkGIx0QhRuGxkpoR0nOMbZ/C";

export class EncryptionFailed extends Data.TaggedError("EncryptionFailed")<{
	readonly message: string;
}> {
	get internalMessage() {
		return `Error happened while encrypting data :  ${this.message}`;
	}
}

const hash = (password: string) =>
	Effect.tryPromise({
		try: () => bcrypt.hash(password, SALT_ROUNDS),
		catch: () => new EncryptionFailed({ message: "hashing faliled" }),
	});

const verify = (password: string, hash: string) =>
	Effect.tryPromise({
		try: () => bcrypt.compare(password, hash),
		catch: () => new EncryptionFailed({ message: "comparaison failed " }),
	});

export class EncryptService extends Context.Service<
	EncryptService,
	{ readonly hash: typeof hash; readonly verify: typeof verify }
>()("api/EncryptService") {
	static readonly Default = Layer.succeed(this, { hash, verify });
}
