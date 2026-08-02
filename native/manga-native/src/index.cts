// Point d'entrée CJS de la librairie.

import * as addon from "./load.cjs";

// Le binaire natif n'a pas de types : on les déclare ici.
declare module "./load.cjs" {
	function getMangaChapters(
		slug: string,
		provider: string,
	): Promise<RawMangaChapter[]>;
}

interface RawMangaChapter {
	chapterNumber: number;
	pages: string[];
}

export type MangaProvider = "SUSHISCAN" | "MANGA_ORIGINS";

export interface MangaChapter {
	chapterNumber: number;
	pages: string[];
}

export function getMangaChapters(
	slug: string,
	provider: MangaProvider,
): Promise<MangaChapter[]> {
	return addon.getMangaChapters(slug, provider);
}
