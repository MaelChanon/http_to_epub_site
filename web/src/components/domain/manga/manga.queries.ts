import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AniListId, Manga } from "@/lib/api";
import { getManga, refreshManga } from "@/lib/api";

export const mangaKeys = {
	all: ["manga"] as const,
	details: () => [...mangaKeys.all, "detail"] as const,
	detail: (mangaId: AniListId) => [...mangaKeys.details(), mangaId] as const,
};

export function useManga(mangaId: AniListId) {
	return useQuery({
		queryKey: mangaKeys.detail(mangaId),
		queryFn: () => getManga(mangaId),
	});
}

export function useRefreshManga(mangaId: AniListId) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => refreshManga(mangaId),
		onSuccess: (manga: Manga) => {
			queryClient.setQueryData(mangaKeys.detail(mangaId), manga);
		},
	});
}
