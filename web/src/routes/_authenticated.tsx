import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}

		return { user };
	},
	component: Outlet,
});
