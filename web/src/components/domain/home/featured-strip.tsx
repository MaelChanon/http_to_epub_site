import { Link } from "@tanstack/react-router";
import { coverHue, displayTitle } from "@/components/domain/manga/manga.util";
import type { MangaSummary } from "@/lib/api";

interface FeaturedStripProps {
	mangas: readonly MangaSummary[];
}

export function FeaturedStrip({ mangas }: FeaturedStripProps) {
	const featured = mangas
		.filter((m) => m.latestChapterAt !== null)
		.sort(
			(a, b) =>
				(b.latestChapterAt?.getTime() ?? 0) -
				(a.latestChapterAt?.getTime() ?? 0),
		)
		.slice(0, 3);

	if (featured.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{featured.map((manga) => {
				const title = displayTitle(manga);
				const hue = coverHue(manga.mangaId.toString());
				return (
					<Link
						key={manga.mangaId}
						to="/manga/$mangaId"
						params={{ mangaId: String(manga.mangaId) }}
						className="flex items-stretch gap-3.5 rounded-[16px] border border-(--line) bg-(--bg-elev) p-3.5 text-inherit no-underline shadow-(--shadow-sm) transition-all hover:-translate-y-0.5 hover:border-(--brand) hover:shadow-(--shadow-md)"
					>
						<div
							className="aspect-2/3 w-[74px] shrink-0 overflow-hidden rounded-md"
							style={{
								backgroundImage: `repeating-linear-gradient(135deg, oklch(0.36 0.06 ${hue}) 0 6px, oklch(0.44 0.08 ${hue}) 6px 12px)`,
							}}
						>
							<img
								src={manga.coverUrl}
								alt={title}
								className="size-full object-cover"
							/>
						</div>
						<div className="flex min-w-0 flex-1 flex-col justify-between">
							<div>
								<div className="mb-1.5 font-mono text-[10px] tracking-[0.08em] text-(--brand) uppercase">
									New drop
								</div>
								<h3 className="mb-1 truncate text-[15px] font-semibold tracking-[-0.015em]">
									{title}
								</h3>
							</div>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
