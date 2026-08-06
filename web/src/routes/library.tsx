import { createFileRoute, redirect } from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LibraryPage } from "@/components/domain/library/library-page";
import { Header } from "@/components/header";

export const Route = createFileRoute("/library")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}
	},
	component: LibraryRoute,
});

function LibraryRoute() {
	return (
		<div className="min-h-screen">
			<Header />
			<main className="mx-auto max-w-[1440px] px-4 sm:px-8">
				<div className="py-5">
					<Breadcrumbs
						items={[{ label: "Browse", to: "/" }, { label: "Library" }]}
					/>
				</div>
				<LibraryPage />
			</main>
		</div>
	);
}
