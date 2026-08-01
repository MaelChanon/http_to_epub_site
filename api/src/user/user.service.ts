import { Effect } from "effect";
import { EncryptService } from "../encrypt/encryptService.js";
import type { UserId } from "./user.domain.js";
import { UsersRepository } from "./user.repository.js";
import type { CreateUserPayload } from "./user.schema.js";

export class UserService extends Effect.Service<UserService>()(
	"api/UserService",
	{
		effect: Effect.gen(function* () {
			const repo = yield* UsersRepository;
			const encryption = yield* EncryptService;

			function createUser(payload: CreateUserPayload) {
				return Effect.gen(function* () {
					const hashedPassword = yield* encryption.hash(payload.password);
					return yield* repo.create({
						pseudo: payload.pseudo,
						email: payload.email,
						password: hashedPassword,
					});
				});
			}

			function getUserById(id: UserId) {
				return repo.getById(id);
			}

			function getUserByEmail(email: string) {
				return repo.getByEmail(email);
			}

			function getUserByEmailWithPassword(email: string) {
				return repo.getByEmailWithPassword(email);
			}

			return {
				createUser,
				getUserById,
				getUserByEmail,
				getUserByEmailWithPassword,
			} as const;
		}),
		dependencies: [UsersRepository.Default, EncryptService.Default],
	},
) {}
