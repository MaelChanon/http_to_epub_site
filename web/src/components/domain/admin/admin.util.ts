import type { Permission } from "@/lib/api";

export const GRID_COLS = "md:grid-cols-[1fr_76px_76px_76px_76px_40px_40px]";

export const permissionLabels: Record<Permission, string> = {
	MANGA_METADATA_REFRESH: "Metadata",
	MANGA_PROVIDER_ADD: "Add",
	MANGA_PROVIDER_REFRESH: "Refresh",
	MANGA_PROVIDER_DELETE: "Delete",
};

export const fullPermissionLabels: Record<Permission, string> = {
	MANGA_METADATA_REFRESH: "Refresh manga metadata",
	MANGA_PROVIDER_ADD: "Add a manga provider",
	MANGA_PROVIDER_REFRESH: "Refresh a manga provider",
	MANGA_PROVIDER_DELETE: "Delete a manga provider",
};

export function initialHue(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return hash % 360;
}
