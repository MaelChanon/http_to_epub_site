import type * as React from "react";
import { IconHeart, IconRefresh } from "@/components/icons";
import { ApiError, type Manga } from "@/lib/api";
import {
	useAddFavorite,
	useRefreshManga,
	useRemoveFavorite,
} from "./manga.queries";
import {
	coverHue,
	displayTitle,
	formatEnumLabel,
	synopsisText,
} from "./manga.util";

const STATUS_DOT_CLASS: Record<Manga["status"], string> = {
	ONGOING:
		"bg-[oklch(0.65_0.18_150)] shadow-[0_0_0_3px_oklch(0.65_0.18_150/0.2)]",
	FINISHED: "bg-(--ink-muted)",
	CANCELLED: "bg-(--ink-muted)",
	HIATUS: "bg-[oklch(0.7_0.16_60)] shadow-[0_0_0_3px_oklch(0.7_0.16_60/0.2)]",
	NOT_YET_RELEASED: "bg-(--ink-muted)",
};

interface MangaHeroProps {
	manga: Manga;
}

export function MangaHero({ manga }: MangaHeroProps) {
	const refreshMutation = useRefreshManga(manga.mangaId);
	const addFavorite = useAddFavorite();
	const removeFavorite = useRemoveFavorite();
	const favoritePending = addFavorite.isPending || removeFavorite.isPending;
	const title = displayTitle(manga);
	const hue = coverHue(manga.id);
	const year = manga.publishedAt ? manga.publishedAt.getFullYear() : "—";
	const [primaryStaff, ...restStaff] = manga.staff;

	function toggleFavorite() {
		if (manga.isFavorite) {
			removeFavorite.mutate(manga.mangaId);
		} else {
			addFavorite.mutate(manga.mangaId);
		}
	}

	return (
		<div className="grid grid-cols-1 gap-6 border-b border-(--line) py-5 pb-10 sm:grid-cols-[180px_1fr] sm:gap-8 lg:grid-cols-[260px_1fr] lg:gap-11 lg:pb-14">
			<div className="mx-auto w-full max-w-[180px] sm:mx-0 sm:max-w-none">
				<div
					className="relative aspect-2/3 overflow-hidden rounded-[10px] shadow-(--shadow-lg)"
					style={{
						backgroundImage: `repeating-linear-gradient(135deg, oklch(0.3 0.04 ${hue}) 0 8px, oklch(0.38 0.07 ${hue}) 8px 16px)`,
					}}
				>
					<img
						src={manga.coverUrl}
						alt={title}
						className="absolute inset-0 size-full object-cover"
					/>
					<div className="absolute inset-x-3 top-3 flex justify-end gap-1.5 font-mono text-[9.5px]">
						<span className="rounded-[4px] border border-(--line) bg-(--bg-elev) px-1.5 py-1 text-(--ink)">
							{year}
						</span>
					</div>
					<div className="absolute inset-x-2.5 bottom-2.5 rounded-[5px] bg-(--bg-elev) px-1.5 py-1 font-mono text-[10px] leading-tight text-(--ink)">
						{title}
					</div>
				</div>

				<div className="mt-2.5">
					<button
						type="button"
						onClick={() => refreshMutation.mutate()}
						disabled={refreshMutation.isPending}
						className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-[11px] text-(--ink-muted) hover:bg-(--bg-elev-2) hover:text-(--ink) disabled:opacity-50"
					>
						<IconRefresh
							className={refreshMutation.isPending ? "animate-spin" : undefined}
						/>
						{refreshMutation.isPending ? "Refreshing…" : "Refresh metadata"}
					</button>
					{refreshMutation.isError && (
						<p role="alert" className="mt-1 text-[12px] text-destructive">
							{refreshMutation.error instanceof ApiError
								? refreshMutation.error.message
								: "Something went wrong"}
						</p>
					)}
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-4.5">
				<div className="flex flex-wrap items-center justify-between gap-2.5">
					<div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] tracking-[0.06em] text-(--ink-muted) uppercase">
						<b className="font-semibold text-(--brand) tracking-[-0.01em] normal-case">
							[{formatEnumLabel(manga.format)}]
						</b>
						<span className="opacity-40">·</span>
						<span
							className={`size-1.5 rounded-full ${STATUS_DOT_CLASS[manga.status]}`}
						/>
						<span>{formatEnumLabel(manga.status)}</span>
					</div>
					<button
						type="button"
						disabled={favoritePending}
						onClick={toggleFavorite}
						aria-pressed={manga.isFavorite}
						aria-label={
							manga.isFavorite ? "Remove from favorites" : "Add to favorites"
						}
						className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
							manga.isFavorite
								? "border-(--line) bg-(--bg-elev-2) text-[oklch(0.65_0.2_20)]"
								: "border-(--line) bg-(--bg-elev) text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
						}`}
					>
						<IconHeart
							className="size-4"
							fill={manga.isFavorite ? "currentColor" : "none"}
						/>
						{manga.isFavorite ? "Favorited" : "Favorite"}
					</button>
				</div>

				<h1 className="text-[34px] leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-[44px] sm:leading-[0.97] sm:tracking-[-0.04em] lg:text-[56px] lg:leading-[0.95] lg:tracking-[-0.045em]">
					{title}
				</h1>

				{manga.titleNative !== title && (
					<p className="text-[13px] text-(--ink-muted)">{manga.titleNative}</p>
				)}

				{primaryStaff && (
					<div className="flex flex-wrap items-baseline gap-3 text-[16px] text-(--ink-soft)">
						<span className="font-mono text-[11px] tracking-[0.06em] text-(--ink-muted) uppercase">
							by
						</span>
						<span className="font-medium text-(--ink)">
							{primaryStaff.name}
						</span>
						<span className="opacity-40">·</span>
						<span className="font-mono text-[11px] tracking-[0.06em] text-(--ink-muted) uppercase">
							{primaryStaff.role}
						</span>
					</div>
				)}
				{restStaff.length > 0 && (
					<p className="text-[12.5px] text-(--ink-muted)">
						{restStaff
							.map((staff) => `${staff.name} (${staff.role})`)
							.join(" · ")}
					</p>
				)}

				<div className="mt-1 flex border-t border-b border-(--line) py-3.5">
					<Stat label="chapters" value={manga.totalChapters ?? "—"} />
					<Stat
						label="score"
						value={manga.score === null ? "—" : `${manga.score}%`}
					/>
					<Stat label="status" value={formatEnumLabel(manga.status)} />
					<Stat label="format" value={formatEnumLabel(manga.format)} />
				</div>

				{manga.genres.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{manga.genres.map((genre) => (
							<span
								key={genre}
								className="rounded-full bg-(--bg-elev-2) px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.02em] text-(--ink-soft)"
							>
								{formatEnumLabel(genre)}
							</span>
						))}
					</div>
				)}

				{manga.summary ? (
					<p className="max-w-[680px] text-[15.5px] leading-[1.55] whitespace-pre-line text-(--ink-soft)">
						{synopsisText(manga.summary)}
					</p>
				) : (
					<p className="max-w-[680px] text-[13.5px] text-(--ink-muted) italic">
						No synopsis available.
					</p>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="min-w-0 flex-1 border-r border-(--line) px-2 first:pl-0 last:border-r-0 last:pr-0 sm:px-4.5">
			<div className="truncate font-mono text-[9px] tracking-[0.06em] text-(--ink-muted) uppercase sm:text-[10px] sm:tracking-[0.08em]">
				{label}
			</div>
			<div className="mt-1 truncate font-mono text-[14px] text-(--ink) tabular-nums tracking-[-0.02em] sm:text-[18px]">
				{value}
			</div>
		</div>
	);
}
