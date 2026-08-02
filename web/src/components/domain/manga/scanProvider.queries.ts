import { useQuery } from "@tanstack/react-query";
import type { AniListId, MangaProviderName } from "@/lib/api";
import { getChapterPages, getMangaProviders } from "@/lib/api";

export const scanProviderKeys = {
	all: ["scanProvider"] as const,
	mangaProviders: (mangaId: AniListId) =>
		[...scanProviderKeys.all, "providers", mangaId] as const,
	chapterPages: (
		mangaId: AniListId,
		provider: MangaProviderName,
		number: number,
	) => [...scanProviderKeys.all, "pages", mangaId, provider, number] as const,
};

export function useMangaProviders(mangaId: AniListId) {
	return useQuery({
		queryKey: scanProviderKeys.mangaProviders(mangaId),
		queryFn: () => getMangaProviders(mangaId),
	});
}

export function useChapterPages(
	mangaId: AniListId,
	provider: MangaProviderName,
	number: number,
) {
	return useQuery({
		queryKey: scanProviderKeys.chapterPages(mangaId, provider, number),
		queryFn: () => getChapterPages(mangaId, provider, number),
	});
}
