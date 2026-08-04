import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMangaSearch } from "@/components/domain/manga/manga.queries";
import {
	displayTitle,
	formatEnumLabel,
} from "@/components/domain/manga/manga.util";
import { IconClose, IconSearch } from "@/components/icons";
import { useDebouncedCallback } from "@/hooks/use-debounced-value";

export function AniListSearchBar() {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const debouncedSetSearch = useDebouncedCallback(setDebouncedSearch, 350);

	const query = debouncedSearch.trim();
	const { data, isFetching, isError } = useMangaSearch(query);
	const results = data ?? [];
	const showPanel = open && query.length > 0;

	function onPointerDown(e: PointerEvent) {
		if (!containerRef.current?.contains(e.target as Node)) {
			setOpen(false);
		}
	}
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			setOpen(false);
		}
	}
	function handleChange(value: string) {
		setSearch(value);
		debouncedSetSearch(value);
		setOpen(true);
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
	}

	function handleClear() {
		setSearch("");
		setDebouncedSearch("");
		setOpen(false);
		document.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("keydown", onKeyDown);
	}

	return (
		<div ref={containerRef} className="relative w-full max-w-sm">
			<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--ink-muted)">
				<IconSearch />
			</span>
			<input
				value={search}
				onChange={(e) => handleChange(e.target.value)}
				onFocus={() => setOpen(true)}
				placeholder="Search AniList to add a manga…"
				aria-label="Search AniList"
				className="h-9 w-full rounded-[8px] border border-(--line) bg-(--bg-elev) pr-9 pl-9 text-[13px] text-(--ink) outline-none placeholder:text-(--ink-muted) focus:border-(--brand) focus:ring-3 focus:ring-(--brand-soft)"
			/>
			{search && (
				<button
					type="button"
					onClick={handleClear}
					aria-label="Clear search"
					className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink)"
				>
					<IconClose />
				</button>
			)}

			{showPanel && (
				<div className="absolute top-[calc(100%+6px)] left-0 z-30 max-h-96 w-full overflow-y-auto rounded-[10px] border border-(--line) bg-(--bg-elev) py-1.5 shadow-(--shadow-lg)">
					{isFetching && (
						<div className="px-3.5 py-3 text-[12px] text-(--ink-muted)">
							Searching AniList…
						</div>
					)}
					{isError && !isFetching && (
						<div className="px-3.5 py-3 text-[12px] text-(--ink-muted)">
							Something went wrong.
						</div>
					)}
					{!isFetching && !isError && results.length === 0 && (
						<div className="px-3.5 py-3 text-[12px] text-(--ink-muted)">
							No mangas match.
						</div>
					)}
					{!isFetching &&
						results.map((r) => (
							<Link
								key={r.mangaId}
								to="/manga/$mangaId"
								params={{ mangaId: String(r.mangaId) }}
								onClick={handleClear}
								className="flex items-center gap-3 px-3.5 py-2 text-inherit no-underline hover:bg-(--bg-elev-2)"
							>
								<div className="h-11 w-8 shrink-0 overflow-hidden rounded-[4px] bg-(--bg-elev-2)">
									<img
										src={r.coverImageUrl}
										alt=""
										className="size-full object-cover"
									/>
								</div>
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className="truncate text-[13px] font-medium text-(--ink)">
										{displayTitle(r)}
									</span>
									<span className="font-mono text-[10.5px] text-(--ink-muted)">
										{r.publishedAt ? r.publishedAt.getFullYear() : "—"} ·{" "}
										{formatEnumLabel(r.format)}
									</span>
								</div>
							</Link>
						))}
				</div>
			)}
		</div>
	);
}
