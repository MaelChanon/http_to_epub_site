import { useEpubs } from "../manga/epub.queries";
import { MangaLibraryRow } from "./manga-library-row";

export function LibraryPage() {
	const { data: mangas = [], isPending } = useEpubs();

	if (isPending) {
		return (
			<p className="py-20 text-center text-(--ink-muted)">Loading library…</p>
		);
	}

	if (mangas.length === 0) {
		return (
			<div className="py-20 text-center font-mono text-[12px] text-(--ink-muted)">
				No epub generated yet. Generate one from a manga's page.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{mangas.map((entry) => (
				<MangaLibraryRow
					key={entry.mangaId}
					mangaId={entry.mangaId}
					mangaTitle={entry.mangaTitle}
					mangaCoverUrl={entry.mangaCoverUrl}
					epubs={entry.epubs}
				/>
			))}
		</div>
	);
}
