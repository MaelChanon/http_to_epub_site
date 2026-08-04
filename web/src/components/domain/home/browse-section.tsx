import { useMangaList } from "@/components/domain/manga/manga.queries";
import { ALL_PROVIDERS } from "@/components/domain/manga/scanProvider.util";
import { ApiError } from "@/lib/api";
import { BrowseSearchInput } from "./browse-search-input";
import { FilterBar } from "./filter-bar";
import { MangaCard } from "./manga-card";
import { MangaGrid } from "./manga-grid";
import { SectionHeader } from "./section-header";
import { EmptyState, ErrorRow, LoadingRow } from "./status-rows";
import { useBrowseFilters } from "./use-browse-filters";
import { useFavoriteToggle } from "./use-favorite-toggle";

export function BrowseSection() {
	const { data: list, isPending, isError, error } = useMangaList();
	const { favoritePending, toggleFavorite } = useFavoriteToggle(list);

	const filters = useBrowseFilters(list);

	return (
		<section className="border-t border-(--line) pt-8 pb-9 first:border-t-0">
			<SectionHeader num="[03/03]" title="Browse" sub="live search" />

			<BrowseSearchInput value={filters.query} onChange={filters.setQuery} />

			<FilterBar
				providers={ALL_PROVIDERS}
				providerCounts={filters.providerCounts}
				totalCount={list?.length ?? 0}
				activeProviders={filters.activeProviders}
				onToggleProvider={filters.toggleProvider}
				onClearProviders={filters.clearProviders}
				genres={filters.genres}
				activeGenres={filters.activeGenres}
				onToggleGenre={filters.toggleGenre}
				onClearGenres={filters.clearGenres}
				years={filters.years}
				year={filters.year}
				onYear={filters.setYear}
				sort={filters.sort}
				onSort={filters.setSort}
				view={filters.view}
				onView={filters.setView}
			/>

			{isPending && <LoadingRow />}

			{isError && (
				<ErrorRow
					message={error instanceof ApiError ? error.message : undefined}
				/>
			)}

			{!isPending &&
				!isError &&
				(filters.filtered.length === 0 ? (
					<EmptyState title="No mangas match." body="Try clearing filters." />
				) : (
					<MangaGrid view={filters.view}>
						{filters.filtered.map((m) => (
							<MangaCard
								key={m.id}
								manga={m}
								layout={filters.view}
								favoritePending={favoritePending(m.mangaId)}
								onToggleFavorite={toggleFavorite}
							/>
						))}
					</MangaGrid>
				))}
		</section>
	);
}
