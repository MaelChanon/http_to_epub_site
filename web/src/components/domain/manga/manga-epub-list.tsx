import type { Epub } from "@/lib/api";
import { EpubRow } from "../library/epub-row";

export function MangaEpubList({ epubs }: { epubs: readonly Epub[] }) {
	return (
		<div className="rounded-[10px] border border-(--line) bg-(--bg-elev)">
			<div className="border-b border-(--line) px-4.5 py-3.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
				generated epubs
			</div>
			<div className="px-2 pb-2">
				{epubs.map((epub) => (
					<EpubRow key={epub.id} epub={epub} />
				))}
			</div>
		</div>
	);
}
