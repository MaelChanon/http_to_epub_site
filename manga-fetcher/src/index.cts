// Point d'entrée CJS de la librairie.

import * as addon from "./load.cjs";

// Le binaire natif n'a pas de types : on les déclare ici.
declare module "./load.cjs" {
	function getMangaChapters(
		slug: string,
		provider: string,
	): Promise<RawMangaChapter[]>;
	function getProviderCatalog(provider: string): Promise<RawMangaCatalogEntry[]>;
	function buildEpub(input: RawBuildEpubInput): Promise<RawBuildEpubOutput>;
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

interface RawBuildEpubInput {
	tag: string;
	name: string;
	coverUrl: string;
	creator: string;
	lang: string;
	width: number;
	height: number;
	splitDoublePage: boolean;
	chapters: { chapterNumber: number; pages: string[] }[];
	outputPath: string;
}

interface RawBuildEpubOutput {
	fileSizeBytes: number;
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

export interface BuildEpubChapterInput {
	chapterNumber: number;
	/** URLs présignées vers notre propre S3 — jamais des URLs du site source. */
	pages: string[];
}

export interface BuildEpubInput {
	tag: string;
	name: string;
	/** URL présignée vers notre propre S3. */
	coverUrl: string;
	creator: string;
	lang: string;
	width: number;
	height: number;
	splitDoublePage: boolean;
	chapters: BuildEpubChapterInput[];
	/** Chemin absolu où écrire le fichier .epub produit. */
	outputPath: string;
}

export interface BuildEpubOutput {
	fileSizeBytes: number;
}

export function buildEpub(input: BuildEpubInput): Promise<BuildEpubOutput> {
	return addon.buildEpub(input);
}

