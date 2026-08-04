import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { AniListId, Manga, MangaSummary } from "@/lib/api";
import {
	addFavorite,
	getManga,
	listMangas,
	refreshManga,
	removeFavorite,
	searchManga,
} from "@/lib/api";

export const mangaKeys = {
	all: ["manga"] as const,
	details: () => [...mangaKeys.all, "detail"] as const,
	detail: (mangaId: AniListId) => [...mangaKeys.details(), mangaId] as const,
	lists: () => [...mangaKeys.all, "list"] as const,
	list: () => [...mangaKeys.lists()] as const,
	searches: () => [...mangaKeys.all, "search"] as const,
	search: (q: string) => [...mangaKeys.searches(), q] as const,
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

export function useMangaList() {
	return useQuery({
		queryKey: mangaKeys.list(),
		queryFn: listMangas,
	});
}

export function useMangaSearch(q: string) {
	const query = q.trim();
	return useQuery({
		queryKey: mangaKeys.search(query),
		queryFn: query ? () => searchManga(query) : skipToken,
		enabled: query.length > 0,
	});
}

function useFavoriteMutation(
	mutationFn: (mangaId: AniListId) => Promise<Manga>,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSuccess: (manga: Manga) => {
			queryClient.setQueryData(mangaKeys.detail(manga.mangaId), manga);
			queryClient.setQueryData<MangaSummary[]>(mangaKeys.list(), (old) =>
				old?.map((item) =>
					item.mangaId === manga.mangaId
						? { ...item, isFavorite: manga.isFavorite }
						: item,
				),
			);
			queryClient.invalidateQueries({ queryKey: mangaKeys.list() });
		},
	});
}

export function useAddFavorite() {
	return useFavoriteMutation(addFavorite);
}

export function useRemoveFavorite() {
	return useFavoriteMutation(removeFavorite);
}
