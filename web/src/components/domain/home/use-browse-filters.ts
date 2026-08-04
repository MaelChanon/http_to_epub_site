import { useMemo, useState } from "react";
import { displayTitle } from "@/components/domain/manga/manga.util";
import { ALL_PROVIDERS } from "@/components/domain/manga/scanProvider.util";
import type { MangaGenre, MangaProviderName, MangaSummary } from "@/lib/api";
import type { SortKey } from "./filter-bar";

export const ANY_YEAR = "__any";

function matchesQuery(manga: MangaSummary, query: string) {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return true;
	}
	return [manga.titleRomaji, manga.titleEnglish, manga.titleNative]
		.filter((title): title is string => !!title)
		.some((title) => title.toLowerCase().includes(needle));
}

export function useBrowseFilters(list: readonly MangaSummary[] | undefined) {
	const [query, setQuery] = useState("");
	const [activeProviders, setActiveProviders] = useState<MangaProviderName[]>(
		[],
	);
	const [activeGenres, setActiveGenres] = useState<MangaGenre[]>([]);
	const [year, setYear] = useState(ANY_YEAR);
	const [sort, setSort] = useState<SortKey>("score");
	const [view, setView] = useState<"grid" | "list">("grid");

	function toggleProvider(id: MangaProviderName) {
		setActiveProviders((cur) =>
			cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
		);
	}

	function clearProviders() {
		setActiveProviders([]);
	}

	function toggleGenre(genre: MangaGenre) {
		setActiveGenres((cur) =>
			cur.includes(genre) ? cur.filter((x) => x !== genre) : [...cur, genre],
		);
	}

	function clearGenres() {
		setActiveGenres([]);
	}

	const genres = useMemo(
		() => Array.from(new Set((list ?? []).flatMap((m) => m.genres))).sort(),
		[list],
	);

	const years = useMemo(
		() =>
			Array.from(
				new Set(
					(list ?? [])
						.map((m) => m.publishedAt?.getFullYear())
						.filter((y): y is number => y !== undefined),
				),
			).sort((a, b) => b - a),
		[list],
	);

	const providerCounts = useMemo(() => {
		const counts: Record<MangaProviderName, number> = {} as Record<
			MangaProviderName,
			number
		>;
		for (const provider of ALL_PROVIDERS) {
			counts[provider] = (list ?? []).filter((m) =>
				m.providers.includes(provider),
			).length;
		}
		return counts;
	}, [list]);

	const filtered = useMemo(() => {
		const out = (list ?? []).filter((m) => {
			if (!matchesQuery(m, query)) {
				return false;
			}
			if (
				activeProviders.length > 0 &&
				!m.providers.some((p) => activeProviders.includes(p))
			) {
				return false;
			}
			if (
				activeGenres.length > 0 &&
				!m.genres.some((g) => activeGenres.includes(g))
			) {
				return false;
			}
			if (
				year !== ANY_YEAR &&
				String(m.publishedAt?.getFullYear() ?? "") !== year
			) {
				return false;
			}
			return true;
		});

		const comparators: Record<
			SortKey,
			(a: MangaSummary, b: MangaSummary) => number
		> = {
			score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
			"year-desc": (a, b) =>
				(b.publishedAt?.getFullYear() ?? 0) -
				(a.publishedAt?.getFullYear() ?? 0),
			"year-asc": (a, b) =>
				(a.publishedAt?.getFullYear() ?? 0) -
				(b.publishedAt?.getFullYear() ?? 0),
			title: (a, b) => displayTitle(a).localeCompare(displayTitle(b)),
			chapters: (a, b) => (b.totalChapters ?? 0) - (a.totalChapters ?? 0),
		};

		return [...out].sort(comparators[sort]);
	}, [list, query, activeProviders, activeGenres, year, sort]);

	return {
		query,
		setQuery,
		activeProviders,
		activeGenres,
		year,
		sort,
		view,
		toggleProvider,
		clearProviders,
		toggleGenre,
		clearGenres,
		setYear,
		setSort,
		setView,
		genres,
		years,
		providerCounts,
		filtered,
	};
}
