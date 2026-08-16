import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
	IconAlertTriangle,
	IconChevronRight,
	IconClose,
	IconDownload,
	IconPlus,
	IconRefresh,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { StatusBars } from "@/components/ui/status-bars";
import type { Manga, MangaProviderChapters } from "@/lib/api";
import { AddProviderDialog } from "./add-provider-dialog";
import type { ChapterRange } from "./manga.util";
import { formatEnumLabel, providerColor } from "./manga.util";
import {
	useDeleteMangaProviderChapters,
	useDownloadProviderArchive,
	useMangaProviders,
	useSyncMangaChapters,
} from "./scanProvider.queries";
import { isProviderTransitioning, missingProviders } from "./scanProvider.util";

const PER_PAGE = 12;

interface ChapterListProps {
	manga: Manga;
	range?: ChapterRange;
}

export function ChapterList({ manga, range }: ChapterListProps) {
	const { data: providers = [], isPending } = useMangaProviders(manga.mangaId);
	const [activeProvider, setActiveProvider] = useState<string>();
	const [order, setOrder] = useState<"desc" | "asc">("desc");
	const [page, setPage] = useState(0);
	const [addProviderOpen, setAddProviderOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<MangaProviderChapters>();
	const missing = useMemo(() => missingProviders(providers), [providers]);
	const syncMutation = useSyncMangaChapters(manga.mangaId);
	const deleteMutation = useDeleteMangaProviderChapters(manga.mangaId);
	const archiveMutation = useDownloadProviderArchive(manga.mangaId);

	const providerId = activeProvider ?? providers[0]?.provider;
	const activeProviderEntry = providers.find((p) => p.provider === providerId);
	const chapters = activeProviderEntry?.chapters ?? [];

	useEffect(() => {
		if (
			activeProvider &&
			!providers.some((p) => p.provider === activeProvider)
		) {
			setActiveProvider(undefined);
		}
	}, [activeProvider, providers]);

	const sorted = useMemo(() => {
		const list = [...chapters];
		if (order === "desc") {
			list.reverse();
		}
		return list;
	}, [chapters, order]);

	const totalPages = Math.ceil(sorted.length / PER_PAGE);
	const pageItems = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
	const mangaId = String(manga.mangaId);

	if (isPending) {
		return (
			<div className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
				loading chapters…
			</div>
		);
	}

	if (!providerId) {
		return (
			<div>
				{missing.length > 0 && (
					<div className="mb-5 flex justify-end border-b border-(--line) pb-2.5">
						<button
							type="button"
							onClick={() => setAddProviderOpen(true)}
							aria-label="Add provider"
							className="grid size-8 shrink-0 place-items-center rounded-md border border-(--line) text-(--ink-muted) hover:border-(--line-strong) hover:text-(--ink)"
						>
							<IconPlus />
						</button>
					</div>
				)}
				<div className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
					no chapters found for this manga yet
				</div>
				<AddProviderDialog
					manga={manga}
					linkedProviders={providers}
					open={addProviderOpen}
					onOpenChange={setAddProviderOpen}
				/>
			</div>
		);
	}

	return (
		<div>
			{providers.length > 0 && (
				<div className="mb-5 flex items-stretch border-b border-(--line)">
					<div className="flex flex-1">
						{providers.map((provider) => {
							const isActive = providerId === provider.provider;
							const isTransitioning = isProviderTransitioning(provider.status);
							const isFailed = provider.status === "FAILED";
							const isDeleting =
								deleteMutation.isPending &&
								deleteMutation.variables === provider.provider;
							return (
								<div
									key={provider.provider}
									className={`-mb-px flex items-center border-b-2 ${
										isActive ? "border-(--brand)" : "border-transparent"
									}`}
								>
									<button
										type="button"
										title={
											isTransitioning
												? `${formatEnumLabel(provider.status)}…`
												: isFailed
													? "Failed — try refreshing"
													: undefined
										}
										onClick={() => {
											setActiveProvider(provider.provider);
											setPage(0);
										}}
										className={`flex items-center gap-2.5 px-4.5 py-3 text-[13px] font-medium ${
											isActive
												? "text-(--ink)"
												: "text-(--ink-muted) hover:text-(--ink)"
										}`}
									>
										<span
											className="size-1.5 rounded-full"
											style={{ background: providerColor(provider.provider) }}
										/>
										{formatEnumLabel(provider.provider)}
										<span
											className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10.5px] ${
												isActive
													? "bg-(--brand-soft) text-(--brand)"
													: "bg-(--bg-elev-2) text-(--ink-muted)"
											}`}
										>
											{provider.chapters.length} ch
										</span>
										{isTransitioning && <StatusBars />}
										{isFailed && (
											<span className="flex items-center gap-1 text-destructive">
												<IconAlertTriangle className="size-3.5" />
												<span className="font-mono text-[10px] normal-case">
													failed
												</span>
											</span>
										)}
									</button>
									<button
										type="button"
										aria-label={`Delete ${formatEnumLabel(provider.provider)} chapters`}
										disabled={isDeleting || isTransitioning}
										onClick={() => setDeleteTarget(provider)}
										className="mr-2 grid size-6 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-destructive disabled:opacity-50"
									>
										<IconClose className="size-3.5" />
									</button>
								</div>
							);
						})}
					</div>
					{missing.length > 0 && (
						<button
							type="button"
							onClick={() => setAddProviderOpen(true)}
							aria-label="Add provider"
							className="my-auto mr-1 grid size-8 shrink-0 place-items-center rounded-md border border-(--line) text-(--ink-muted) hover:border-(--line-strong) hover:text-(--ink)"
						>
							<IconPlus />
						</button>
					)}
				</div>
			)}
			{activeProviderEntry?.status === "FAILED" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-[12.5px] text-destructive">
					<span className="flex items-center gap-2">
						<IconAlertTriangle className="size-4 shrink-0" />
						Last sync for {formatEnumLabel(activeProviderEntry.provider)}{" "}
						failed.
					</span>
				</div>
			)}
			<div className="mb-2.5 flex items-center justify-between gap-4">
				<div className="flex items-center gap-1 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
					<span>
						[chapters]{" "}
						<b className="ml-2 font-medium text-(--ink) normal-case">
							{chapters.length} total
						</b>
					</span>
					{activeProviderEntry && (
						<>
							<button
								type="button"
								aria-label={`Refresh ${formatEnumLabel(activeProviderEntry.provider)}`}
								disabled={isProviderTransitioning(activeProviderEntry.status)}
								onClick={() => {
									syncMutation.mutate({
										provider: activeProviderEntry.provider,
										slug: activeProviderEntry.tag,
									});
								}}
								className="ml-1 grid size-6 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink) disabled:opacity-50"
							>
								<IconRefresh
									className={`size-3.5 ${isProviderTransitioning(activeProviderEntry.status) ? "animate-spin" : ""}`}
								/>
							</button>
							<button
								type="button"
								aria-label={`Download ${formatEnumLabel(activeProviderEntry.provider)} archive`}
								disabled={isProviderTransitioning(activeProviderEntry.status)}
								onClick={() => {
									archiveMutation.mutate(activeProviderEntry.provider);
								}}
								className="grid size-6 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink) disabled:opacity-50"
							>
								<IconDownload className="size-3.5" />
							</button>
						</>
					)}
				</div>
				<div className="flex gap-1 font-mono text-[10.5px]">
					<button
						type="button"
						onClick={() => setOrder("desc")}
						className={`rounded-md px-2 py-1 ${order === "desc" ? "bg-(--bg-elev-2) text-(--ink)" : "text-(--ink-muted)"}`}
					>
						newest
					</button>
					<button
						type="button"
						onClick={() => setOrder("asc")}
						className={`rounded-md px-2 py-1 ${order === "asc" ? "bg-(--bg-elev-2) text-(--ink)" : "text-(--ink-muted)"}`}
					>
						oldest
					</button>
				</div>
			</div>
			<div className="flex flex-col border-t border-(--line)">
				{pageItems.map((chapter) => {
					const inRange =
						!!range &&
						chapter.number >= range.start &&
						chapter.number <= range.end;
					return (
						<Link
							key={chapter.number}
							to="/manga/$mangaId/$providerId/$chapterId"
							params={{
								mangaId,
								providerId,
								chapterId: String(chapter.number),
							}}
							className={`relative grid grid-cols-[56px_1fr_110px_64px_40px] items-center gap-4 border-b border-(--line) px-2 py-3.5 text-inherit no-underline before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${
								inRange
									? "bg-(--brand-soft) before:bg-(--brand) hover:bg-(--brand-soft)"
									: "before:bg-transparent hover:bg-(--bg-elev)"
							}`}
						>
							<div
								className={`font-mono text-[12px] tabular-nums ${inRange ? "font-semibold text-(--brand)" : "text-(--ink-muted)"}`}
							>
								Ch. {String(chapter.number).padStart(3, "0")}
							</div>
							<div className="truncate text-[13.5px] font-medium tracking-[-0.005em] text-(--ink)">
								Chapter {chapter.number}
							</div>
							<div className="font-mono text-[11px] text-(--ink-muted) tabular-nums">
								{chapter.createdAt.toLocaleDateString()}
							</div>
							<div className="text-right font-mono text-[10.5px] text-(--ink-muted)">
								{chapter.pageCount}p
							</div>
							<span className="grid size-[30px] place-items-center rounded-md text-(--ink-muted)">
								<IconChevronRight />
							</span>
						</Link>
					);
				})}
			</div>
			{totalPages > 1 && (
				<div className="flex items-center justify-between pt-3.5 font-mono text-[11px] text-(--ink-muted)">
					<button
						type="button"
						disabled={page === 0}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						className="rounded-md border border-(--line) bg-(--bg-elev) px-3 py-1.5 disabled:opacity-40"
					>
						← prev
					</button>
					<span>
						page {page + 1} / {totalPages}
					</span>
					<button
						type="button"
						disabled={page >= totalPages - 1}
						onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
						className="rounded-md border border-(--line) bg-(--bg-elev) px-3 py-1.5 disabled:opacity-40"
					>
						next →
					</button>
				</div>
			)}
			<AddProviderDialog
				manga={manga}
				linkedProviders={providers}
				open={addProviderOpen}
				onOpenChange={setAddProviderOpen}
			/>
			<Dialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete {deleteTarget && formatEnumLabel(deleteTarget.provider)}{" "}
							chapters?
						</DialogTitle>
						<DialogDescription>
							This permanently removes {deleteTarget?.chapters.length}{" "}
							chapter(s) and all their pages from storage. This cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDeleteTarget(undefined)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={deleteMutation.isPending}
							onClick={() => {
								if (!deleteTarget) {
									return;
								}
								deleteMutation.mutate(deleteTarget.provider, {});
								setDeleteTarget(undefined);
							}}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
