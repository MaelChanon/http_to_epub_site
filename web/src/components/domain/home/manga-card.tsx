import { Link } from "@tanstack/react-router";
import {
	coverHue,
	displayTitle,
	formatEnumLabel,
	providerColor,
} from "@/components/domain/manga/manga.util";
import { IconHeart } from "@/components/icons";
import type { AniListId, MangaProviderName } from "@/lib/api";

interface MangaCardItem {
	mangaId: AniListId;
	titleRomaji: string | null;
	titleEnglish: string | null;
	titleNative: string;
	isFavorite: boolean;
	format: string;
	publishedAt: Date | null;
	score: number | null;
	coverUrl: string;
	providers?: readonly MangaProviderName[];
}

interface MangaCardProps {
	manga: MangaCardItem;
	onToggleFavorite: (mangaId: AniListId) => void;
	favoritePending?: boolean;
	layout?: "grid" | "list";
}

export function MangaCard({
	manga,
	onToggleFavorite,
	favoritePending,
	layout = "grid",
}: MangaCardProps) {
	const title = displayTitle(manga);
	const year = manga.publishedAt ? manga.publishedAt.getFullYear() : null;
	const hue = coverHue(manga.mangaId.toString());
	const isList = layout === "list";
	const providers = manga.providers ?? [];

	const favoriteButton = (
		<button
			type="button"
			disabled={favoritePending}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onToggleFavorite(manga.mangaId);
			}}
			aria-label={
				manga.isFavorite ? "Remove from favorites" : "Add to favorites"
			}
			aria-pressed={manga.isFavorite}
			className={`z-10 grid size-7.5 shrink-0 place-items-center rounded-full backdrop-blur-sm transition-transform hover:scale-110 disabled:opacity-60 ${
				isList ? "" : "absolute top-2 right-2"
			} ${manga.isFavorite ? "text-[oklch(0.65_0.2_20)]" : "text-(--ink-soft)"}`}
			style={{
				background: "color-mix(in oklch, var(--bg-elev) 88%, transparent)",
			}}
		>
			<IconHeart
				className="size-4"
				fill={manga.isFavorite ? "currentColor" : "none"}
			/>
		</button>
	);

	return (
		<Link
			to="/manga/$mangaId"
			params={{ mangaId: String(manga.mangaId) }}
			className={`group text-inherit no-underline ${
				isList ? "flex items-center gap-3.5" : "flex flex-col gap-2.5"
			}`}
		>
			<div
				className={`relative aspect-2/3 shrink-0 overflow-hidden rounded-[10px] shadow-(--shadow-lg) transition-transform duration-200 ${
					isList ? "w-16" : "w-full group-hover:-translate-y-1"
				}`}
				style={{
					backgroundImage: `repeating-linear-gradient(135deg, oklch(0.3 0.04 ${hue}) 0 8px, oklch(0.38 0.07 ${hue}) 8px 16px)`,
				}}
			>
				<img
					src={manga.coverUrl}
					alt={title}
					className={`absolute inset-0 size-full object-cover ${
						isList
							? "transition-transform duration-200 group-hover:scale-105"
							: ""
					}`}
				/>
				{!isList && providers.length > 0 && (
					<div className="absolute inset-x-2 top-2 z-10 flex flex-wrap gap-1">
						{providers.map((provider) => (
							<span
								key={provider}
								className="rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] font-medium tracking-[-0.01em] text-(--ink) backdrop-blur-sm"
								style={{
									background:
										"color-mix(in oklch, var(--bg-elev) 88%, transparent)",
									borderColor:
										"color-mix(in oklch, var(--line) 50%, transparent)",
								}}
							>
								{formatEnumLabel(provider)}
							</span>
						))}
					</div>
				)}
				{!isList && favoriteButton}
			</div>

			<div className={`flex min-w-0 flex-col gap-1 ${isList ? "flex-1" : ""}`}>
				<div className="flex items-center gap-1.5 font-mono text-[10px] text-(--ink-muted)">
					{year && <span className="opacity-70">{year}</span>}
					{manga.score !== null && (
						<span className="text-(--ink-soft)">★ {manga.score}</span>
					)}
				</div>
				<div className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-(--ink)">
					{title}
				</div>
				<div className="flex items-center gap-1.5 font-mono text-[10.5px] text-(--ink-muted)">
					<span className="text-(--ink-soft)">
						{formatEnumLabel(manga.format)}
					</span>
					{providers.length > 0 && (
						<span className="inline-flex items-center gap-1.5">
							{providers.map((provider) => (
								<span key={provider} className="inline-flex items-center gap-1">
									<span
										className="size-1.5 rounded-full"
										style={{ background: providerColor(provider) }}
									/>
									{isList ? formatEnumLabel(provider) : null}
								</span>
							))}
						</span>
					)}
				</div>
			</div>

			{isList && favoriteButton}
		</Link>
	);
}
