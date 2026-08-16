import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission, User } from "@/lib/api";
import {
	createInvite,
	createPasswordReset,
	deleteUser,
	listUsers,
	User as UserSchema,
	updateUserPermissions,
} from "@/lib/api";

export const adminKeys = {
	all: ["admin"] as const,
	users: () => [...adminKeys.all, "users"] as const,
	passwordReset: (token: string) =>
		[...adminKeys.all, "password-reset", token] as const,
};

export function useAdminUsers() {
	return useQuery({
		queryKey: adminKeys.users(),
		queryFn: listUsers,
	});
}

export function useCreateInvite() {
	return useMutation({
		mutationFn: (permissions: readonly Permission[]) =>
			createInvite(permissions),
	});
}

export function useCreatePasswordReset() {
	return useMutation({
		mutationFn: (user: User) => createPasswordReset(user.id),
	});
}

export function useUpdateUserPermissions() {
	const queryClient = useQueryClient();

	function patchUser(id: User["id"], patch: (user: User) => User) {
		queryClient.setQueryData<readonly User[]>(adminKeys.users(), (current) =>
			current?.map((entry) => (entry.id === id ? patch(entry) : entry)),
		);
	}

	return useMutation({
		mutationFn: ({
			user,
			permissions,
		}: {
			user: User;
			permissions: readonly Permission[];
		}) => updateUserPermissions(user.id, permissions),
		onMutate: async ({ user, permissions }) => {
			await queryClient.cancelQueries({ queryKey: adminKeys.users() });
			const previous = queryClient.getQueryData<readonly User[]>(
				adminKeys.users(),
			);
			patchUser(user.id, (entry) => new UserSchema({ ...entry, permissions }));
			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) {
				queryClient.setQueryData(adminKeys.users(), context.previous);
			}
		},
		onSuccess: (updated) => {
			patchUser(updated.id, () => updated);
		},
	});
}

export function useDeleteUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (user: User) => deleteUser(user.id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminKeys.users() });
		},
	});
}
