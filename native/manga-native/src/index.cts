// Point d'entrée CJS de la librairie.

import * as addon from "./load.cjs";

// Le binaire natif n'a pas de types : on les déclare ici.
declare module "./load.cjs" {
	function getMangaChapters(
		slug: string,
		provider: string,
	): Promise<RawMangaChapter[]>;
	function getProviderCatalog(provider: string): Promise<RawMangaCatalogEntry[]>;
}

interface RawMangaChapter {
	chapterNumber: number;
	pages: string[];
}

interface RawMangaCatalogEntry {
	tag: string;
	name: string;
	coverUrl: string;
	chapterCount: number;
}

export type MangaProvider = "SUSHISCAN" | "MANGA_ORIGINS";

export interface MangaChapter {
	chapterNumber: number;
	pages: string[];
}

export interface MangaCatalogEntry {
	tag: string;
	name: string;
	coverUrl: string;
	chapterCount: number;
}

export function getMangaChapters(
	slug: string,
	provider: MangaProvider,
): Promise<MangaChapter[]> {
	return addon.getMangaChapters(slug, provider);
}

export function getProviderCatalog(
	provider: MangaProvider,
): Promise<MangaCatalogEntry[]> {
	return addon.getProviderCatalog(provider);
}

