import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { IconChevronRight } from "@/components/icons";
import type { AniListId, Epub } from "@/lib/api";
import { EpubRow } from "./epub-row";

export function MangaLibraryRow({
	mangaId,
	mangaTitle,
	mangaCoverUrl,
	epubs,
}: {
	mangaId: AniListId;
	mangaTitle: string;
	mangaCoverUrl: string;
	epubs: readonly Epub[];
}) {
	const [open, setOpen] = useState(false);

	return (
		<div className="rounded-[10px] border border-(--line) bg-(--bg-elev)">
			<button
				aria-label={open ? "Collapse" : "Expand"}
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-3.5 px-4 py-3.5 w-full"
			>
				<img
					src={mangaCoverUrl}
					alt=""
					className="h-14 w-10 shrink-0 rounded-md object-cover"
				/>
				<div className="min-w-0 flex-1">
					<Link
						to="/manga/$mangaId"
						params={{ mangaId: String(mangaId) }}
						className="w-fit block"
					>
						<div className="truncate text-[14px] font-medium text-(--ink) hover:underline w-fit">
							{mangaTitle}
						</div>
					</Link>
					<div className="font-mono text-[10.5px] text-(--ink-muted) w-fit">
						{epubs.length} epub{epubs.length > 1 ? "s" : ""}
					</div>
				</div>
				<div className="grid size-7 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink)">
					<IconChevronRight
						className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
					/>
				</div>
			</button>
			{open && (
				<div className="border-t border-(--line) px-2 pb-2">
					{epubs.map((epub) => (
						<EpubRow key={epub.id} epub={epub} />
					))}
				</div>
			)}
		</div>
	);
}
