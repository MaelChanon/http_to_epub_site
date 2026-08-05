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
		MANGA_ORIGINS: (tag) => `https://mangas-origines.fr/oeuvre/${tag}/`,
	};

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
