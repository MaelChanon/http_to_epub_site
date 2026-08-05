import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { useEffect } from "react";
import type {
	AniListId,
	MangaProviderChapters,
	MangaProviderName,
} from "@/lib/api";
import {
	buildProviderArchive,
	deleteMangaProviderChapters,
	getChapterPages,
	getMangaProviders,
	ScanEvent,
	searchProviderCatalog,
	syncMangaChapters,
} from "@/lib/api";
import { runTrackedTask } from "@/lib/task-queue";

export const scanProviderKeys = {
	all: ["scanProvider"] as const,
	mangaProviders: (mangaId: AniListId) =>
		[...scanProviderKeys.all, "providers", mangaId] as const,
	chapterPages: (
		mangaId: AniListId,
		provider: MangaProviderName,
		number: number,
	) => [...scanProviderKeys.all, "pages", mangaId, provider, number] as const,
	catalogSearch: (provider: MangaProviderName | undefined, query: string) =>
		[...scanProviderKeys.all, "catalogSearch", provider, query] as const,
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

export function useSearchProviderCatalog(
	provider: MangaProviderName | undefined,
	query: string,
) {
	const canSearch = !!provider && query.trim().length > 0;
	return useQuery({
		queryKey: scanProviderKeys.catalogSearch(provider, query),
		queryFn: canSearch
			? () => searchProviderCatalog(provider, query)
			: skipToken,
		enabled: !!provider && query.trim().length > 0,
	});
}

export function useSyncMangaChapters(mangaId: AniListId) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			provider,
			slug,
			label,
		}: {
			provider: MangaProviderName;
			slug: string;
			label: string;
		}) => runTrackedTask(label, syncMangaChapters(mangaId, { slug, provider })),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: scanProviderKeys.mangaProviders(mangaId),
			});
		},
	});
}

export function useDeleteMangaProviderChapters(mangaId: AniListId) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (provider: MangaProviderName) =>
			deleteMangaProviderChapters(mangaId, provider),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: scanProviderKeys.mangaProviders(mangaId),
			});
		},
	});
}

const decodeScanEvent = Schema.decodeUnknownSync(ScanEvent);

export function useMangaProviderEvents(mangaId: AniListId) {
	const queryClient = useQueryClient();

	useEffect(() => {
		const source = new EventSource(`/api/manga/${mangaId}/events`, {
			withCredentials: true,
		});
		const queryKey = scanProviderKeys.mangaProviders(mangaId);

		source.onmessage = (event) => {
			const { provider, status } = decodeScanEvent(JSON.parse(event.data));

			queryClient.setQueryData<readonly MangaProviderChapters[]>(
				queryKey,
				(old) => {
					if (!old) {
						return old;
					}
					return status === null
						? old.filter((p) => p.provider !== provider)
						: old.map((p) => (p.provider === provider ? { ...p, status } : p));
				},
			);

			queryClient.invalidateQueries({ queryKey });
		};

		return () => {
			source.close();
		};
	}, [mangaId, queryClient]);
}

export function useDownloadProviderArchive(mangaId: AniListId) {
	return useMutation({
		mutationFn: ({
			provider,
			label,
		}: {
			provider: MangaProviderName;
			label: string;
		}) => runTrackedTask(label, buildProviderArchive(mangaId, provider)),
		onSuccess: ({ url }) => {
			const link = document.createElement("a");
			link.href = url;
			link.download = "";
			link.click();
		},
	});
}
