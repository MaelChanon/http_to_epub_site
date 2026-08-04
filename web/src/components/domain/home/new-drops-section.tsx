import { useMangaList } from "@/components/domain/manga/manga.queries";
import { FeaturedStrip } from "./featured-strip";
import { SectionHeader } from "./section-header";

export function NewDropsSection() {
	const { data: list } = useMangaList();

	if (!list) {
		return null;
	}

	return (
		<section className="border-t border-(--line) pt-8 pb-9 first:border-t-0">
			<SectionHeader num="[01/02]" title="New drops" sub="recently synced" />
			<FeaturedStrip mangas={list} />
		</section>
	);
}
