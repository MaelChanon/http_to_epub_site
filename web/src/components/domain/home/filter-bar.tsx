import type { ReactNode } from "react";
import {
	formatEnumLabel,
	providerColor,
} from "@/components/domain/manga/manga.util";
import { IconGrid, IconList } from "@/components/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { MangaGenre, MangaProviderName } from "@/lib/api";

export type SortKey = "score" | "year-desc" | "year-asc" | "title" | "chapters";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: "score", label: "Score ↓" },
	{ value: "year-desc", label: "Year ↓ (newest)" },
	{ value: "year-asc", label: "Year ↑ (oldest)" },
	{ value: "title", label: "Title A–Z" },
	{ value: "chapters", label: "Chapters ↓" },
];

const ANY_YEAR = "__any";

interface FilterBarProps {
	providers: readonly MangaProviderName[];
	providerCounts: Record<MangaProviderName, number>;
	totalCount: number;
	activeProviders: MangaProviderName[];
	onToggleProvider: (id: MangaProviderName) => void;
	onClearProviders: () => void;
	disableProviders?: boolean;
	genres: readonly MangaGenre[];
	activeGenres: MangaGenre[];
	onToggleGenre: (genre: MangaGenre) => void;
	onClearGenres: () => void;
	disableGenres?: boolean;
	years: readonly number[];
	year: string;
	onYear: (value: string) => void;
	sort: SortKey;
	onSort: (value: SortKey) => void;
	view: "grid" | "list";
	onView: (value: "grid" | "list") => void;
}

export function FilterBar({
	providers,
	providerCounts,
	totalCount,
	activeProviders,
	onToggleProvider,
	onClearProviders,
	disableProviders,
	genres,
	activeGenres,
	onToggleGenre,
	onClearGenres,
	disableGenres,
	years,
	year,
	onYear,
	sort,
	onSort,
	view,
	onView,
}: FilterBarProps) {
	return (
		<div className="mt-1 flex flex-col gap-2 pt-5 pb-1">
			<div
				className={`flex flex-wrap items-center gap-2.5 ${disableProviders ? "pointer-events-none opacity-40" : ""}`}
			>
				<span className="mr-1 font-mono text-[11px] text-(--ink-muted) uppercase">
					Providers
				</span>
				<Chip active={activeProviders.length === 0} onClick={onClearProviders}>
					All <Count>{totalCount}</Count>
				</Chip>
				{providers.map((provider) => (
					<Chip
						key={provider}
						active={activeProviders.includes(provider)}
						onClick={() => onToggleProvider(provider)}
					>
						<span
							className="size-1.5 rounded-full"
							style={{ background: providerColor(provider) }}
						/>
						{formatEnumLabel(provider)}
						<Count>{providerCounts[provider] ?? 0}</Count>
					</Chip>
				))}

				<div className="ml-auto flex gap-0.5 rounded-md border border-(--line) bg-(--bg-elev) p-0.5">
					<button
						type="button"
						onClick={() => onView("grid")}
						aria-label="Grid view"
						className={`grid h-6.5 w-8 place-items-center rounded-[4px] ${view === "grid" ? "bg-(--bg) text-(--ink) shadow-(--shadow-sm)" : "text-(--ink-muted)"}`}
					>
						<IconGrid />
					</button>
					<button
						type="button"
						onClick={() => onView("list")}
						aria-label="List view"
						className={`grid h-6.5 w-8 place-items-center rounded-[4px] ${view === "list" ? "bg-(--bg) text-(--ink) shadow-(--shadow-sm)" : "text-(--ink-muted)"}`}
					>
						<IconList />
					</button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2.5">
				<span className="mr-1 font-mono text-[11px] text-(--ink-muted) uppercase">
					Genre
				</span>
				<div
					className={`flex flex-wrap items-center gap-2.5 ${disableGenres ? "pointer-events-none opacity-40" : ""}`}
				>
					<Chip active={activeGenres.length === 0} onClick={onClearGenres}>
						Any
					</Chip>
					{genres.map((genre) => (
						<Chip
							key={genre}
							active={activeGenres.includes(genre)}
							onClick={() => onToggleGenre(genre)}
						>
							{formatEnumLabel(genre)}
						</Chip>
					))}
				</div>

				<div className="ml-auto flex items-center gap-2.5">
					<Select value={year} onValueChange={onYear}>
						<SelectTrigger className="w-[110px]">
							<SelectValue placeholder="Year" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ANY_YEAR}>Any year</SelectItem>
							{years.map((y) => (
								<SelectItem key={y} value={String(y)}>
									{y}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={sort}
						onValueChange={(value) => onSort(value as SortKey)}
					>
						<SelectTrigger className="w-[160px]">
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}

function Chip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex h-7.5 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
				active
					? "border-(--ink) bg-(--ink) text-(--bg)"
					: "border-(--line) bg-(--bg-elev) text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
			}`}
		>
			{children}
		</button>
	);
}

function Count({ children }: { children: ReactNode }) {
	return <span className="font-mono text-[10.5px] opacity-60">{children}</span>;
}
