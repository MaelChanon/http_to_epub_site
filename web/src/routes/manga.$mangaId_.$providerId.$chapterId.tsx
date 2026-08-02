import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { ChapterReader } from "@/components/domain/manga/chapter-reader";
import { useManga } from "@/components/domain/manga/manga.queries";
import { AniListId, MangaProviderName } from "@/lib/api";

const isMangaProviderName = Schema.is(MangaProviderName);

export const Route = createFileRoute("/manga/$mangaId_/$providerId/$chapterId")(
	{
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
	},
);

function ChapterPage() {
	const { mangaId: rawMangaId, providerId, chapterId } = Route.useParams();
	const parsedMangaId = Number(rawMangaId);
	const { data: manga } = useManga(AniListId.make(parsedMangaId));

	if (!manga) {
		return (
			<p className="py-20 text-center font-mono text-[12px] text-(--ink-muted)">
				loading chapter…
			</p>
		);
	}

	if (!isMangaProviderName(providerId)) {
		return (
			<div className="py-20 text-center">
				<h2 className="text-lg font-semibold text-(--ink)">Unknown provider</h2>
				<p className="mt-1 text-[13px] text-(--ink-muted)">
					"{providerId}" is not a supported scan provider.
				</p>
			</div>
		);
	}

	return (
		<ChapterReader
			key={`${providerId}-${chapterId}`}
			manga={manga}
			providerId={providerId}
			chapterNumber={Number(chapterId)}
		/>
	);
}
