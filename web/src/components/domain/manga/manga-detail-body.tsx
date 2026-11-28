import type { MangaWithEpub } from "@workspace/api";
import { useMemo, useState } from "react";
import type { MangaProviderName } from "@/lib/api";
import { ChapterList } from "./chapter-list";
import { GenerateEpubPanel } from "./generate-epub-panel";
import type { ChapterRange } from "./manga.util";
import { MangaEpubList } from "./manga-epub-list";
import { MangaHero } from "./manga-hero";
import {
	useMangaProviderEvents,
	useMangaProviders,
} from "./scanProvider.queries";

export function MangaDetailBody({ manga }: { manga: MangaWithEpub }) {
	useMangaProviderEvents(manga.mangaId);
	const { data: providers = [] } = useMangaProviders(manga.mangaId);
	// Shared by the chapter list and the generate panel, so the EPUB is built
	// from the provider whose chapters are on screen.
	const [selectedProvider, setSelectedProvider] = useState<MangaProviderName>();
	const provider = providers.some((p) => p.provider === selectedProvider)
		? selectedProvider
		: providers[0]?.provider;
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
			<div className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_560px]">
				<div className="flex flex-col gap-5">
					<ChapterList
						manga={manga}
						range={range}
						provider={provider}
						onProviderChange={setSelectedProvider}
					/>
					<MangaEpubList epubs={manga.epubs} />
				</div>
				<div className="flex flex-col gap-5 self-start">
					<GenerateEpubPanel
						manga={manga}
						totalChapters={totalChapters}
						provider={provider}
						onProviderChange={setSelectedProvider}
						range={range}
						onRangeChange={setRange}
					/>
				</div>
			</div>
		</>
	);
}
