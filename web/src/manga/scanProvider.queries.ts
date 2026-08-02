import { useQuery } from "@tanstack/react-query";
import type { AniListId } from "@/lib/api";
import { getMangaProviders } from "@/lib/api";

export const scanProviderKeys = {
	all: ["scanProvider"] as const,
	mangaProviders: (mangaId: AniListId) =>
		[...scanProviderKeys.all, "providers", mangaId] as const,
};

export function useMangaProviders(mangaId: AniListId) {
	return useQuery({
		queryKey: scanProviderKeys.mangaProviders(mangaId),
		queryFn: () => getMangaProviders(mangaId),
	});
}
