import { Context, Effect, Layer } from "effect";
import { UserService } from "../domain/user/user.service.js";
import {
	InvalidSession,
	MissingSession,
	SessionService,
} from "../session/session.service.js";

const make = Effect.gen(function* () {
	const sessionService = yield* SessionService;
	const userService = yield* UserService;

	const authenticate = Effect.fn("AuthService.authenticate")(function* (
		token: string,
	) {
		if (!token) {
			return yield* new MissingSession();
		}
		const userId = yield* sessionService.verifyToken(token);
		return yield* userService
			.getUserById(userId)
			.pipe(
				Effect.mapError(() => new InvalidSession({ reason: "user not found" })),
			);
	});

	return { authenticate };
});

export class AuthService extends Context.Service<AuthService>()(
	"api/AuthService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([SessionService.Default, UserService.Default]),
	);
}
