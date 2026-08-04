import { Link } from "@tanstack/react-router";
import { useMangaList } from "@/components/domain/manga/manga.queries";
import { Header } from "@/components/header";
import { MangaCard } from "./manga-card";
import { MangaGrid } from "./manga-grid";
import { SectionHeader } from "./section-header";
import { EmptyState, LoadingRow } from "./status-rows";
import { useFavoriteToggle } from "./use-favorite-toggle";

export function FavoritesOnlyPage() {
	const { data: list, isPending } = useMangaList();
	const { favoritePending, toggleFavorite } = useFavoriteToggle(list);

	const favorites = (list ?? []).filter((m) => m.isFavorite);

	return (
		<div className="min-h-screen">
			<Header />
			<main>
				<div className="mx-auto max-w-[1440px] px-8 pt-8">
					<SectionHeader
						num="[favorites]"
						title="Favorites"
						sub={`${favorites.length} titles`}
					/>
					{isPending && <LoadingRow />}
					{favorites.length === 0 && !isPending && (
						<EmptyState
							title="No favorites yet"
							body="Heart a manga from the browse grid to pin it here."
						/>
					)}
					{favorites.length > 0 && (
						<MangaGrid view="grid">
							{favorites.map((m) => (
								<MangaCard
									key={m.id}
									manga={m}
									favoritePending={favoritePending(m.mangaId)}
									onToggleFavorite={toggleFavorite}
								/>
							))}
						</MangaGrid>
					)}
					<div className="py-10">
						<Link
							to="/"
							className="font-mono text-[11px] text-(--ink-soft) hover:text-(--ink)"
						>
							← browse all
						</Link>
					</div>
				</div>
			</main>
		</div>
	);
}
