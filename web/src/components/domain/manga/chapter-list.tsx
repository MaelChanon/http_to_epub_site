import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { IconChevronRight } from "@/components/icons";
import type { Manga } from "@/lib/api";
import type { ChapterRange } from "./manga.util";
import { formatEnumLabel, providerColor } from "./manga.util";
import { useMangaProviders } from "./scanProvider.queries";

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

	const providerId = activeProvider ?? providers[0]?.provider;
	const chapters = useMemo(
		() => providers.find((p) => p.provider === providerId)?.chapters ?? [],
		[providers, providerId],
	);

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
			<div className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
				no chapters found for this manga yet
			</div>
		);
	}

	return (
		<div>
			{providers.length > 0 && (
				<div className="mb-5 flex border-b border-(--line)">
					{providers.map((provider) => (
						<button
							key={provider.provider}
							type="button"
							onClick={() => {
								setActiveProvider(provider.provider);
								setPage(0);
							}}
							className={`-mb-px flex items-center gap-2.5 border-b-2 px-4.5 py-3 text-[13px] font-medium ${
								providerId === provider.provider
									? "border-(--brand) text-(--ink)"
									: "border-transparent text-(--ink-muted) hover:text-(--ink)"
							}`}
						>
							<span
								className="size-1.5 rounded-full"
								style={{ background: providerColor(provider.provider) }}
							/>
							{formatEnumLabel(provider.provider)}
							<span
								className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10.5px] ${
									providerId === provider.provider
										? "bg-(--brand-soft) text-(--brand)"
										: "bg-(--bg-elev-2) text-(--ink-muted)"
								}`}
							>
								{provider.chapters.length} ch
							</span>
						</button>
					))}
				</div>
			)}

			<div className="mb-2.5 flex items-center justify-between gap-4">
				<div className="font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
					[chapters]{" "}
					<b className="ml-2 font-medium text-(--ink) normal-case">
						{chapters.length} total
					</b>
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
		</div>
	);
}
