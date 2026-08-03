import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { IconArrowLeft } from "@/components/icons";
import type { Manga, MangaProviderName } from "@/lib/api";
import { useSequentialPreload } from "./chapter-preload";
import { displayTitle } from "./manga.util";
import { PagePicker } from "./page-picker";
import { useChapterPages, useMangaProviders } from "./scanProvider.queries";

type ReaderMode = "paged" | "scroll";

interface ChapterReaderProps {
	manga: Manga;
	providerId: MangaProviderName;
	chapterNumber: number;
}

export function ChapterReader({
	manga,
	providerId: provider,
	chapterNumber,
}: ChapterReaderProps) {
	const navigate = useNavigate();
	const mangaId = String(manga.mangaId);
	const title = displayTitle(manga);

	const { data: providers = [] } = useMangaProviders(manga.mangaId);
	const chapters = useMemo(
		() => providers.find((p) => p.provider === provider)?.chapters ?? [],
		[providers, provider],
	);
	const chapterNumbers = useMemo(
		() => chapters.map((c) => c.number),
		[chapters],
	);
	const currentChapterIdx = chapterNumbers.indexOf(chapterNumber);
	const prevChapterNumber =
		currentChapterIdx > 0 ? chapterNumbers[currentChapterIdx - 1] : undefined;
	const nextChapterNumber =
		currentChapterIdx >= 0 && currentChapterIdx < chapterNumbers.length - 1
			? chapterNumbers[currentChapterIdx + 1]
			: undefined;

	const { data: chapterPages, isPending } = useChapterPages(
		manga.mangaId,
		provider,
		chapterNumber,
	);
	const pages = chapterPages?.pages ?? [];
	const loadedCount = useSequentialPreload(pages);

	const [pageIndex, setPageIndex] = useState(0);
	const [mode, setMode] = useState<ReaderMode>("paged");
	const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
	const scrollObserverRef = useRef<IntersectionObserver | null>(null);
	const pendingScrollRef = useRef(false);

	function getScrollObserver() {
		if (!scrollObserverRef.current) {
			scrollObserverRef.current = new IntersectionObserver(
				(entries) => {
					const visible = entries.filter((entry) => entry.isIntersecting);
					if (visible.length === 0) {
						return;
					}
					const topMost = visible.reduce((a, b) =>
						a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
					);
					const index = Number(
						(topMost.target as HTMLElement).dataset.pageIndex,
					);
					if (!Number.isNaN(index)) {
						setPageIndex(index);
					}
				},
				{ rootMargin: "-45% 0px -45% 0px", threshold: 0 },
			);
		}
		return scrollObserverRef.current;
	}

	function enterScrollMode() {
		pendingScrollRef.current = true;
		setMode("scroll");
	}

	function selectPage(index: number) {
		if (mode === "scroll") {
			pageRefs.current[index]?.scrollIntoView({ block: "start" });
		} else {
			setPageIndex(index);
		}
	}

	function goToChapter(number: number) {
		navigate({
			to: "/manga/$mangaId/$providerId/$chapterId",
			params: { mangaId, providerId: provider, chapterId: String(number) },
		});
	}

	function goNext() {
		if (pageIndex < pages.length - 1) {
			if (pageIndex + 1 < loadedCount) {
				setPageIndex((i) => i + 1);
			}
			return;
		}
		if (nextChapterNumber !== undefined) {
			goToChapter(nextChapterNumber);
		}
	}

	function goPrev() {
		if (pageIndex > 0) {
			setPageIndex((i) => i - 1);
			return;
		}
		if (prevChapterNumber !== undefined) {
			goToChapter(prevChapterNumber);
		}
	}

	const total = pages.length;
	const ready = loadedCount > 0;

	return (
		<div className="flex min-h-screen flex-col bg-(--bg)">
			<div className="sticky top-0 z-30 flex items-center gap-3.5 border-b border-(--line) bg-(--bg-elev) px-5 py-3">
				<Link
					to="/manga/$mangaId"
					params={{ mangaId }}
					className="inline-flex shrink-0 items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 font-mono text-[11px] text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
				>
					<IconArrowLeft /> back
				</Link>

				<span className="min-w-0 truncate font-mono text-[13px] font-medium text-(--ink)">
					{title}
				</span>

				{chapters.length > 0 && (
					<select
						value={chapterNumber}
						onChange={(e) => goToChapter(Number(e.target.value))}
						className="h-8 shrink-0 rounded-md border border-(--line) bg-(--bg-elev) px-2.5 font-mono text-[12px] font-medium text-(--ink) outline-none hover:border-(--line-strong) focus:border-(--brand) focus:ring-3 focus:ring-(--brand-soft)"
					>
						{chapters.map((c) => (
							<option key={c.number} value={c.number}>
								Chapter {c.number}
							</option>
						))}
					</select>
				)}

				<div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-(--ink-muted)">
					{total > 0 && (
						<span className="tabular-nums">
							page {pageIndex + 1} / {total}
						</span>
					)}
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => setMode("paged")}
							className={`rounded-md px-2 py-1 ${mode === "paged" ? "bg-(--bg-elev-2) text-(--ink)" : "text-(--ink-muted) hover:text-(--ink)"}`}
						>
							paged
						</button>
						<button
							type="button"
							onClick={enterScrollMode}
							className={`rounded-md px-2 py-1 ${mode === "scroll" ? "bg-(--bg-elev-2) text-(--ink)" : "text-(--ink-muted) hover:text-(--ink)"}`}
						>
							scroll
						</button>
					</div>
					<PagePicker
						total={total}
						loadedCount={loadedCount}
						current={pageIndex}
						onSelect={selectPage}
					/>
				</div>
			</div>

			{!ready && (
				<div className="flex flex-1 items-center justify-center p-5">
					<p className="font-mono text-[12px] text-(--ink-muted)">
						{isPending ? "loading chapter…" : "no pages found for this chapter"}
					</p>
				</div>
			)}

			{ready && mode === "paged" && (
				<div className="relative flex flex-1 items-center justify-center overflow-hidden p-5">
					<div className="relative flex h-full w-full items-center justify-center">
						<img
							src={pages[pageIndex]}
							alt={`Page ${pageIndex + 1}`}
							className="max-h-full max-w-full object-contain"
						/>
						<button
							type="button"
							aria-label="Previous page"
							onClick={goPrev}
							className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
						/>
						<button
							type="button"
							aria-label="Next page"
							onClick={goNext}
							className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
						/>
						<div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-(--ink-muted) opacity-70">
							click left half for previous page · right half for next
						</div>
					</div>
				</div>
			)}

			{ready && mode === "scroll" && (
				<div className="flex flex-col items-center py-5">
					{pages.slice(0, loadedCount).map((src, i) => (
						<div
							key={src}
							ref={(el) => {
								pageRefs.current[i] = el;
								if (!el) {
									return;
								}
								const observer = getScrollObserver();
								observer.observe(el);
								if (pendingScrollRef.current && i === pageIndex) {
									pendingScrollRef.current = false;
									el.scrollIntoView({ block: "start" });
								}
								return () => observer.unobserve(el);
							}}
							data-page-index={i}
							className="w-full max-w-3xl"
						>
							<img
								src={src}
								alt={`Page ${i + 1}`}
								className="block w-full object-contain"
							/>
						</div>
					))}
					{loadedCount < total && (
						<p className="py-8 font-mono text-[11px] text-(--ink-muted)">
							loading {loadedCount}/{total}…
						</p>
					)}
					{loadedCount === total && nextChapterNumber !== undefined && (
						<button
							type="button"
							onClick={() => goToChapter(nextChapterNumber)}
							className="my-8 rounded-md border border-(--line) bg-(--bg-elev) px-4 py-2.5 font-mono text-[12px] text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
						>
							next chapter →
						</button>
					)}
				</div>
			)}
		</div>
	);
}
