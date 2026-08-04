import { useMangaList } from "@/components/domain/manga/manga.queries";
import { MangaCard } from "./manga-card";
import { MangaGrid } from "./manga-grid";
import { SectionHeader } from "./section-header";
import { useFavoriteToggle } from "./use-favorite-toggle";

export function FavoritesSection() {
	const { data: list } = useMangaList();
	const { favoritePending, toggleFavorite } = useFavoriteToggle(list);

	const mangas = (list ?? []).filter((m) => m.isFavorite);

	if (mangas.length === 0) {
		return null;
	}

	return (
		<section className="border-t border-(--line) pt-8 pb-9">
			<SectionHeader
				num="[02/03]"
				title="Favorites"
				sub={`${mangas.length} titles`}
			/>
			<MangaGrid view="grid">
				{mangas.map((m) => (
					<MangaCard
						key={m.id}
						manga={m}
						favoritePending={favoritePending(m.mangaId)}
						onToggleFavorite={toggleFavorite}
					/>
				))}
			</MangaGrid>
		</section>
	);
}
