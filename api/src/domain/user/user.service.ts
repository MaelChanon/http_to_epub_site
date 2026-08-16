import { Effect } from "effect";
import { EncryptService } from "../../encrypt/encryptService.js";
import type { Permission } from "./permission.js";
import type { UserId } from "./user.domain.js";
import { UsersRepository } from "./user.repository.js";

export class UserService extends Effect.Service<UserService>()(
	"api/UserService",
	{
		effect: Effect.gen(function* () {
			const repo = yield* UsersRepository;
			const encryption = yield* EncryptService;

			function createUser(data: {
				pseudo: string;
				email: string;
				password: string;
				permissions: readonly Permission[];
				isAdmin: boolean;
			}) {
				return Effect.gen(function* () {
					const hashedPassword = yield* encryption.hash(data.password);
					return yield* repo.create({ ...data, password: hashedPassword });
				});
			}

			function setPassword(id: UserId, password: string) {
				return Effect.gen(function* () {
					const hashedPassword = yield* encryption.hash(password);
					return yield* repo.updatePassword(id, hashedPassword);
				});
			}

			function countUsers() {
				return repo.count();
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

			function listUsers() {
				return repo.listNonAdmin();
			}

			function updateUserPermissions(
				id: UserId,
				permissions: readonly Permission[],
			) {
				return repo.setPermissions(id, permissions);
			}

			function deleteUser(id: UserId) {
				return repo.deleteUser(id);
			}

			return {
				createUser,
				setPassword,
				countUsers,
				getUserById,
				getUserByEmail,
				getUserByEmailWithPassword,
				listUsers,
				updateUserPermissions,
				deleteUser,
			} as const;
		}),
		dependencies: [UsersRepository.Default, EncryptService.Default],
	},
) {}
