import { MangaProviderName, type MangaProviderStatus } from "@/lib/api";

const TRANSITIONING_STATUSES = new Set<MangaProviderStatus>([
	"CREATING",
	"UPDATING",
	"DELETING",
]);

export function isProviderTransitioning(status: MangaProviderStatus) {
	return TRANSITIONING_STATUSES.has(status);
}

export const ALL_PROVIDERS = MangaProviderName.literals;

const PROVIDER_CATALOG_URL: Record<MangaProviderName, (tag: string) => string> =
	{
		SUSHISCAN: (tag) => `https://sushiscan.fr/catalogue/${tag}/`,
		SUSHISCAN_NET: (tag) => `https://sushiscan.net/catalogue/${tag}/`,
		MANGA_ORIGINS: (tag) => `https://mangas-origines.fr/oeuvre/${tag}/`,
		ANIME_SAMA: (tag) =>
			`https://anime-sama.to/catalogue/${animeSamaPath(tag)}/`,
		WEEBCENTRAL: (tag) => `https://weebcentral.com/series/${tag}`,
	};

function animeSamaPath(tag: string) {
	const version = /^(.+)\.(scan[^.]*)\.([^.]+)$/.exec(tag);
	return version ? `${version[1]}/${version[2]}/${version[3]}` : tag;
}

export function providerCatalogUrl(
	provider: MangaProviderName,
	tag: string,
): string {
	return PROVIDER_CATALOG_URL[provider](tag);
}

export function missingProviders(
	linked: readonly { provider: MangaProviderName }[],
): MangaProviderName[] {
	const linkedSet = new Set(linked.map((p) => p.provider));
	return ALL_PROVIDERS.filter((p) => !linkedSet.has(p));
}
