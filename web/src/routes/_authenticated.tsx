import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { Button } from "@/components/ui/button";

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
	errorComponent: AuthUnavailable,
});

function AuthUnavailable() {
	const router = useRouter();

	return (
		<div className="grid min-h-screen place-items-center px-4">
			<div className="flex max-w-[380px] flex-col items-center gap-3 text-center">
				<div className="font-mono text-[10.5px] tracking-[0.08em] text-(--brand) uppercase">
					[offline]
				</div>
				<h1 className="text-[20px] font-semibold tracking-[-0.02em] text-(--ink)">
					Can't reach the server
				</h1>
				<p className="text-[13.5px] text-(--ink-muted)">
					Your session is still valid — the API just didn't answer.
				</p>
				<Button
					type="button"
					onClick={() => router.invalidate()}
					className="mt-1 h-9 rounded-sm bg-(--brand) px-4 text-[13px] text-(--brand-contrast) hover:bg-(--brand)/90"
				>
					Retry
				</Button>
			</div>
		</div>
	);
}
