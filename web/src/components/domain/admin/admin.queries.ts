import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission, User } from "@/lib/api";
import {
	createInvite,
	createPasswordReset,
	deleteUser,
	listUsers,
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

	return useMutation({
		mutationFn: ({
			user,
			permissions,
		}: {
			user: User;
			permissions: readonly Permission[];
		}) => updateUserPermissions(user.id, permissions),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminKeys.users() });
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
