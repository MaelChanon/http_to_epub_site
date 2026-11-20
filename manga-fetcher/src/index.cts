// Point d'entrée CJS de la librairie.

import * as addon from "./load.cjs";

// Le binaire natif n'a pas de types : on les déclare ici.
declare module "./load.cjs" {
	function getMangaChapters(
		slug: string,
		provider: string,
		clearance: Clearance | null,
	): Promise<RawMangaChapter[]>;
	function getProviderCatalog(
		provider: string,
		clearance: Clearance | null,
	): Promise<RawMangaCatalogEntry[]>;
	function getPageRequestHeaders(
		provider: string,
		clearance: Clearance | null,
	): Record<string, string>;
	function getProviderBaseUrl(provider: string): string;
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

export type MangaProvider =
	| "SUSHISCAN"
	| "SUSHISCAN_NET"
	| "MANGA_ORIGINS"
	| "ANIME_SAMA";

/**
 * Cloudflare clearance from a challenge solver. Only used by the providers behind
 * Cloudflare (SUSHISCAN_NET, ANIME_SAMA), and only while Cloudflare is challenging.
 * `cookie` is the full Cookie header; `userAgent` must be the exact UA the cookie
 * was issued to (Cloudflare binds the two).
 */
export interface Clearance {
	cookie: string;
	userAgent: string;
}

/**
 * Stable prefix on errors meaning "Cloudflare is challenging: a (fresh) clearance
 * is needed". Retrying without a new clearance will never succeed.
 */
export const CLEARANCE_REQUIRED_MARKER = "CF_CLEARANCE_REQUIRED";

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
	clearance?: Clearance,
): Promise<MangaChapter[]> {
	return addon.getMangaChapters(slug, provider, clearance ?? null);
}

export function getProviderCatalog(
	provider: MangaProvider,
	clearance?: Clearance,
): Promise<MangaCatalogEntry[]> {
	return addon.getProviderCatalog(provider, clearance ?? null);
}

/**
 * Headers to send when downloading, from Node, the page URLs returned by
 * `getMangaChapters`. Empty for unprotected providers; for Cloudflare-fronted ones,
 * a `Referer` (always-on hotlink protection), a browser User-Agent and, when given,
 * the clearance cookie. Never send these to any other host.
 */
/**
 * The provider's base URL: the one to hand a Cloudflare challenge solver
 * (`cf_clearance` covers the whole domain, image CDN included).
 */
export function getProviderBaseUrl(provider: MangaProvider): string {
	return addon.getProviderBaseUrl(provider);
}

export function getPageRequestHeaders(
	provider: MangaProvider,
	clearance?: Clearance,
): Record<string, string> {
	return addon.getPageRequestHeaders(provider, clearance ?? null);
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

