import type { Manga } from "@/lib/api";

export function displayTitle(manga: Manga) {
	return manga.titleRomaji ?? manga.titleEnglish ?? manga.titleNative;
}

export function synopsisText(summary: string) {
	return summary.replace(/<[^>]+>/g, "").trim();
}

export function formatEnumLabel(value: string) {
	return value
		.toLowerCase()
		.split("_")
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ");
}

export function coverHue(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return hash % 360;
}
