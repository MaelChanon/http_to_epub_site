import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Header } from "@/components/header";
import { IconArrowLeft } from "@/components/icons";
import { AniListId } from "@/lib/api";
import { useManga } from "@/manga/manga.queries";
import { displayTitle, formatEnumLabel } from "@/manga/manga.util";

export const Route = createFileRoute("/manga/$mangaId/$providerId/$chapterId")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}
	},
	component: ChapterPage,
});

function ChapterPage() {
	const { mangaId: rawMangaId, providerId, chapterId } = Route.useParams();
	const parsedMangaId = Number(rawMangaId);
	const { data: manga } = useManga(AniListId.make(parsedMangaId));
	const title = manga ? displayTitle(manga) : "…";
	const providerLabel = formatEnumLabel(providerId);

	return (
		<div className="min-h-screen">
			<Header />

			<main className="mx-auto max-w-[1440px] px-8">
				<div className="flex items-center gap-3.5 py-5">
					<Link
						to="/manga/$mangaId"
						params={{ mangaId: rawMangaId }}
						className="inline-flex items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 font-mono text-[11px] text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
					>
						<IconArrowLeft /> back
					</Link>
					<Breadcrumbs
						items={[
							{ label: "Browse", to: "/" },
							{ label: title, to: `/manga/${rawMangaId}` },
							{ label: `Chapter ${chapterId}` },
						]}
					/>
				</div>

				<div className="py-24 text-center">
					<h2 className="text-lg font-semibold text-(--ink)">
						Chapter reader — coming soon
					</h2>
					<p className="mt-1 text-[13px] text-(--ink-muted)">
						Chapter {chapterId} of {title} (via {providerLabel}) will be
						readable here once the reader is built.
					</p>
				</div>
			</main>
		</div>
	);
}
