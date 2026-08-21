import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { BrowseSection } from "@/components/domain/home/browse-section";
import { FavoritesOnlyPage } from "@/components/domain/home/favorites-only-page";
import { FavoritesSection } from "@/components/domain/home/favorites-section";
import { NewDropsSection } from "@/components/domain/home/new-drops-section";
import { Header } from "@/components/header";

const homeSearchSchema = Schema.standardSchemaV1(
	Schema.Struct({ favorites: Schema.optional(Schema.Boolean) }),
);

export const Route = createFileRoute("/")({
	validateSearch: homeSearchSchema,
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}
	},
	component: IndexPage,
});

function IndexPage() {
	const { favorites: favoritesOnly } = Route.useSearch();

	if (favoritesOnly) {
		return <FavoritesOnlyPage />;
	}

	return (
		<div className="min-h-screen">
			<Header />

			<main>
				<div className="mx-auto max-w-[1440px] px-4 sm:px-8">
					<NewDropsSection />
					<FavoritesSection />
					<BrowseSection />

					<footer className="mt-10 flex items-center justify-between border-t border-(--line) py-10 font-mono text-[11px] text-(--ink-muted)">
						<div>http → epub · v0.1</div>
					</footer>
				</div>
			</main>
		</div>
	);
}
