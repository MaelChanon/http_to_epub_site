import { Effect } from "effect";
import { UserService } from "../domain/user/user.service.js";
import { UnauthorizedError } from "../http/error.js";
import {
	InvalidSession,
	MissingSession,
	SessionService,
} from "../session/session.service.js";

export class AuthService extends Effect.Service<AuthService>()(
	"api/AuthService",
	{
		effect: Effect.gen(function* () {
			const sessionService = yield* SessionService;
			const userService = yield* UserService;

			function authenticate(token: string) {
				return Effect.gen(function* () {
					if (!token) {
						return yield* Effect.fail(new MissingSession());
					}
					const userId = yield* sessionService.verifyToken(token);
					return yield* userService
						.getUserById(userId)
						.pipe(
							Effect.mapError(
								() => new InvalidSession({ reason: "user not found" }),
							),
						);
				}).pipe(
					Effect.mapError(
						() => new UnauthorizedError({ message: "Invalid session" }),
					),
				);
			}

			return { authenticate } as const;
		}),
		dependencies: [SessionService.Default, UserService.Default],
	},
) {}
