import type { Manga } from "@/lib/api";

export interface ChapterRange {
	start: number;
	end: number;
}

export function displayTitle(manga: Manga) {
	return manga.titleRomaji ?? manga.titleEnglish ?? manga.titleNative;
}

export function synopsisText(summary: string) {
	return summary.replace(/<[^>]+>/g, "").trim();
}

export function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/['’]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function formatEnumLabel(value: string) {
	return value
		.toLowerCase()
		.split("_")
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ");
}

export function hashSeed(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function coverHue(seed: string) {
	return hashSeed(seed) % 360;
}

export function providerColor(provider: string) {
	return `oklch(0.7 0.15 ${coverHue(provider)})`;
}
