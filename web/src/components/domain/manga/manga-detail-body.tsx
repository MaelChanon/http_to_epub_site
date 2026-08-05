import { useMemo, useState } from "react";
import type { Manga } from "@/lib/api";
import { ChapterList } from "./chapter-list";
import { GenerateEpubPanel } from "./generate-epub-panel";
import type { ChapterRange } from "./manga.util";
import { MangaHero } from "./manga-hero";
import {
	useMangaProviderEvents,
	useMangaProviders,
} from "./scanProvider.queries";

export function MangaDetailBody({ manga }: { manga: Manga }) {
	useMangaProviderEvents(manga.mangaId);
	const { data: providers = [] } = useMangaProviders(manga.mangaId);
	const totalChapters = useMemo(
		() =>
			providers.reduce(
				(max, provider) =>
					provider.chapters.reduce((m, c) => Math.max(m, c.number), max),
				0,
			),
		[providers],
	);
	const [range, setRange] = useState<ChapterRange>({
		start: 1,
		end: totalChapters || 1,
	});
	const [prevTotalChapters, setPrevTotalChapters] = useState(totalChapters);
	if (totalChapters !== prevTotalChapters) {
		setPrevTotalChapters(totalChapters);
		setRange({ start: 1, end: totalChapters || 1 });
	}

	return (
		<>
			<MangaHero manga={manga} />
			<div className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_360px]">
				<ChapterList manga={manga} range={range} />
				<GenerateEpubPanel
					manga={manga}
					totalChapters={totalChapters}
					range={range}
					onRangeChange={setRange}
				/>
			</div>
		</>
	);
}
