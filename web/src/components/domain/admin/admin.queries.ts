import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserPayload, Permission, User } from "@/lib/api";
import {
	deleteUser,
	listUsers,
	signup,
	updateUserPermissions,
} from "@/lib/api";

export const adminKeys = {
	all: ["admin"] as const,
	users: () => [...adminKeys.all, "users"] as const,
};

export function useAdminUsers() {
	return useQuery({
		queryKey: adminKeys.users(),
		queryFn: listUsers,
	});
}

export function useCreateUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateUserPayload) => signup(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminKeys.users() });
		},
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
