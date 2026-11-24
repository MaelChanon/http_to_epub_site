import { Context, Effect, Layer } from "effect";
import { EncryptService } from "../../encrypt/encryptService.js";
import type { Permission } from "./permission.js";
import type { UserId } from "./user.domain.js";
import { UsersRepository } from "./user.repository.js";

const make = Effect.gen(function* () {
	const repo = yield* UsersRepository;
	const encryption = yield* EncryptService;

	const createUser = Effect.fn("UserService.createUser")(function* (data: {
		pseudo: string;
		email: string;
		password: string;
		permissions: readonly Permission[];
		isAdmin: boolean;
	}) {
		const hashedPassword = yield* encryption.hash(data.password);
		return yield* repo.create({ ...data, password: hashedPassword });
	});

	const setPassword = Effect.fn("UserService.setPassword")(function* (
		id: UserId,
		password: string,
	) {
		const hashedPassword = yield* encryption.hash(password);
		return yield* repo.updatePassword(id, hashedPassword);
	});

	return {
		createUser,
		setPassword,
		countUsers: repo.count,
		getUserById: repo.getById,
		getUserByEmail: repo.getByEmail,
		getUserByEmailWithPassword: repo.getByEmailWithPassword,
		listUsers: repo.listNonAdmin,
		updateUserPermissions: repo.setPermissions,
		deleteUser: repo.deleteUser,
	};
});

export class UserService extends Context.Service<UserService>()(
	"api/UserService",
	{ make },
) {
	static readonly Default = Layer.effect(this, make).pipe(
		Layer.provide([UsersRepository.Default, EncryptService.Default]),
	);
}
