import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AniListId,
	CreateEpubPayload,
	MangaProviderName,
} from "@/lib/api";
import { generateEpub, listEpubs } from "@/lib/api";

export const epubKeys = {
	all: ["epub"] as const,
	list: () => [...epubKeys.all, "list"] as const,
};

const PENDING_STATUSES = new Set(["PENDING", "PROCESSING"]);

export function useEpubs() {
	return useQuery({
		queryKey: epubKeys.list(),
		queryFn: listEpubs,
		refetchInterval: (query) =>
			query.state.data?.some((manga) =>
				manga.epubs.some((epub) => PENDING_STATUSES.has(epub.status)),
			)
				? 3000
				: false,
	});
}
export function useGenerateEpub(
	mangaId: AniListId,
	provider: MangaProviderName,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateEpubPayload) =>
			generateEpub(mangaId, provider, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: epubKeys.list() });
		},
	});
}
