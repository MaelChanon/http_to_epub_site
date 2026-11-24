import { Effect, Schema } from "effect";
import { permission } from "../../../drizzle/schema/users.js";
import { ForbiddenError } from "../../http/error.js";

export const Permission = Schema.Literals(permission.enumValues);
export type Permission = typeof Permission.Type;

interface WithPermissions {
	readonly isAdmin: boolean;
	readonly permissions: readonly Permission[];
}

export function hasPermission(user: WithPermissions, permission: Permission) {
	return user.isAdmin || user.permissions.includes(permission);
}

export function requireAdmin(user: { readonly isAdmin: boolean }) {
	return user.isAdmin
		? Effect.void
		: Effect.fail(
				new ForbiddenError({
					message: "Only an administrator can perform this action",
				}),
			);
}

export function requirePermission(
	user: WithPermissions,
	permission: Permission,
) {
	return hasPermission(user, permission)
		? Effect.void
		: Effect.fail(
				new ForbiddenError({ message: `Missing permission: ${permission}` }),
			);
}
