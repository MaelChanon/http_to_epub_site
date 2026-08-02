import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useManga } from "@/components/domain/manga/manga.queries";
import { displayTitle } from "@/components/domain/manga/manga.util";
import { MangaDetailBody } from "@/components/domain/manga/manga-detail-body";
import { Header } from "@/components/header";
import { IconArrowLeft } from "@/components/icons";
import { AniListId, ApiError } from "@/lib/api";

export const Route = createFileRoute("/manga/$mangaId")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}
	},
	component: MangaPage,
});

function MangaPage() {
	const { mangaId: rawMangaId } = Route.useParams();
	const parsedMangaId = Number(rawMangaId);

	if (!Number.isInteger(parsedMangaId)) {
		return (
			<div className="min-h-screen">
				<Header />
				<InvalidMangaId />
			</div>
		);
	}

	return <MangaDetail mangaId={AniListId.make(parsedMangaId)} />;
}

function MangaDetail({ mangaId }: { mangaId: AniListId }) {
	const { data: manga, isPending, isError, error } = useManga(mangaId);
	return (
		<div className="min-h-screen">
			<Header />

			<main className="mx-auto max-w-[1440px] px-8">
				<div className="flex items-center gap-3.5 py-5">
					<Link
						to="/"
						className="inline-flex items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 font-mono text-[11px] text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
					>
						<IconArrowLeft /> back
					</Link>
					<Breadcrumbs
						items={[
							{ label: "Browse", to: "/" },
							{ label: manga ? displayTitle(manga) : "…" },
						]}
					/>
				</div>

				{isPending && (
					<p className="py-20 text-center text-(--ink-muted)">Loading manga…</p>
				)}

				{isError && (
					<div className="py-20 text-center">
						<h2 className="text-lg font-semibold text-(--ink)">
							Manga not found
						</h2>
						<p className="mt-1 text-[13px] text-(--ink-muted)">
							{error instanceof ApiError
								? error.message
								: "Something went wrong"}
						</p>
					</div>
				)}

				{manga && <MangaDetailBody manga={manga} />}
			</main>
		</div>
	);
}

function InvalidMangaId() {
	return (
		<main className="mx-auto max-w-[1440px] px-8 py-20 text-center">
			<h2 className="text-lg font-semibold text-(--ink)">Invalid manga id</h2>
			<p className="mt-1 text-[13px] text-(--ink-muted)">
				The manga id in the URL must be a number.
			</p>
		</main>
	);
}
