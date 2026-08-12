import { useMemo, useState } from "react";
import { IconExternalLink } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDebouncedCallback } from "@/hooks/use-debounced-value";
import type {
	Manga,
	MangaProviderChapters,
	MangaProviderName,
	ProviderMangaSummary,
} from "@/lib/api";
import { formatEnumLabel } from "./manga.util";
import {
	useSearchProviderCatalog,
	useSyncMangaChapters,
} from "./scanProvider.queries";
import { missingProviders, providerCatalogUrl } from "./scanProvider.util";

interface AddProviderDialogProps {
	manga: Manga;
	linkedProviders: readonly MangaProviderChapters[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddProviderDialog({
	manga,
	linkedProviders,
	open,
	onOpenChange,
}: AddProviderDialogProps) {
	const missing = useMemo(
		() => missingProviders(linkedProviders),
		[linkedProviders],
	);
	const [provider, setProvider] = useState<MangaProviderName | undefined>();
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const debouncedSetQuery = useDebouncedCallback(setDebouncedQuery, 350);

	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			const defaultQuery =
				manga.titleRomaji ?? manga.titleEnglish ?? manga.titleNative;
			setProvider(missing[0]);
			setQuery(defaultQuery);
			setDebouncedQuery(defaultQuery);
		}
	}

	function handleQueryChange(value: string) {
		setQuery(value);
		debouncedSetQuery(value);
	}

	const searchQuery = useSearchProviderCatalog(provider, debouncedQuery);
	const syncMutation = useSyncMangaChapters(manga.mangaId);

	function handleAdd(result: ProviderMangaSummary) {
		if (!provider) {
			return;
		}
		syncMutation.mutate({
			provider,
			slug: result.tag,
			label: `${formatEnumLabel(provider)} · ${result.name}`,
		});
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a provider</DialogTitle>
					<DialogDescription>
						Search this manga in a provider's catalog and link it to import its
						chapters.
					</DialogDescription>
				</DialogHeader>

				{missing.length === 0 ? (
					<p className="text-[13px] text-(--ink-muted)">
						All providers are already linked to this manga.
					</p>
				) : (
					<div className="flex flex-col gap-3">
						<Select
							value={provider}
							onValueChange={(value) => setProvider(value as MangaProviderName)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Choose a provider" />
							</SelectTrigger>
							<SelectContent>
								{missing.map((p) => (
									<SelectItem key={p} value={p}>
										{formatEnumLabel(p)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="flex gap-2">
							<Input
								value={query}
								onChange={(e) => handleQueryChange(e.target.value)}
								placeholder="Search title…"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => searchQuery.refetch()}
							>
								Search
							</Button>
						</div>

						<div className="scrollbar-thin -mx-1 h-[280px] overflow-y-auto px-1">
							{searchQuery.isFetching && (
								<p className="py-3 text-center font-mono text-[11px] text-(--ink-muted)">
									searching…
								</p>
							)}
							{searchQuery.isError && (
								<p role="alert" className="py-3 text-[12px] text-destructive">
									Something went wrong while searching.
								</p>
							)}
							{!searchQuery.isFetching && searchQuery.data?.length === 0 && (
								<p className="py-3 text-center font-mono text-[11px] text-(--ink-muted)">
									no results
								</p>
							)}
							{searchQuery.data?.map((result) => (
								<div
									key={result.tag}
									className="flex items-center justify-between gap-2 border-b border-(--line) py-2 last:border-b-0"
								>
									<div className="min-w-0">
										<p className="truncate text-[13px] text-(--ink)">
											{result.name}
										</p>
										{provider && (
											<a
												href={providerCatalogUrl(provider, result.tag)}
												target="_blank"
												rel="noreferrer"
												className="inline-flex items-center gap-1 text-[11px] text-(--ink-muted) hover:text-(--brand)"
											>
												view on {formatEnumLabel(provider)}
												<IconExternalLink />
											</a>
										)}
									</div>
									<Button
										type="button"
										size="sm"
										onClick={() => handleAdd(result)}
									>
										Add
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
