import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LibraryPage } from "@/components/domain/library/library-page";
import { Header } from "@/components/header";

export const Route = createFileRoute("/_authenticated/library")({
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
