import {
	useAddFavorite,
	useRemoveFavorite,
} from "@/components/domain/manga/manga.queries";
import type { AniListId, MangaSummary } from "@/lib/api";

export function useFavoriteToggle(list: readonly MangaSummary[] | undefined) {
	const addFavorite = useAddFavorite();
	const removeFavorite = useRemoveFavorite();

	function isFavorite(mangaId: AniListId) {
		return list?.find((m) => m.mangaId === mangaId)?.isFavorite ?? false;
	}

	function favoritePending(mangaId: AniListId) {
		return (
			(addFavorite.isPending && addFavorite.variables === mangaId) ||
			(removeFavorite.isPending && removeFavorite.variables === mangaId)
		);
	}

	function toggleFavorite(mangaId: AniListId) {
		if (isFavorite(mangaId)) {
			removeFavorite.mutate(mangaId);
		} else {
			addFavorite.mutate(mangaId);
		}
	}

	return { favoritePending, toggleFavorite };
}
