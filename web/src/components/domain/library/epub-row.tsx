import { IconDownload } from "@/components/icons";
import { StatusBars } from "@/components/ui/status-bars";
import type { Epub } from "@/lib/api";
import { formatEnumLabel, providerColor } from "../manga/manga.util";

export function EpubRow({ epub }: { epub: Epub }) {
	const isPending = epub.status === "PENDING" || epub.status === "PROCESSING";

	return (
		<div className="grid grid-cols-[1fr_100px_90px_110px_40px] items-center gap-4 border-b border-(--line) px-2 py-3">
			<div className="min-w-0">
				<div className="truncate text-[13px] text-(--ink)">
					{epub.filename}.epub
				</div>
				<div className="flex items-center gap-2 truncate font-mono text-[10.5px] text-(--ink-muted)">
					<span
						className="size-1.5 shrink-0 rounded-full"
						style={{ background: providerColor(epub.provider) }}
					/>
					{formatEnumLabel(epub.provider)} · ch.{" "}
					{String(epub.chapterStart).padStart(3, "0")}–
					{String(epub.chapterEnd).padStart(3, "0")}
				</div>
			</div>
			<div className="font-mono text-[11px] text-(--ink-muted) tabular-nums">
				{epub.width}×{epub.height}
			</div>
			<div>
				{epub.status === "DONE" && (
					<span className="font-mono text-[10.5px] text-(--brand) uppercase">
						done
					</span>
				)}
				{epub.status === "FAILED" && (
					<span className="font-mono text-[10.5px] text-destructive uppercase">
						failed
					</span>
				)}
				{isPending && (
					<span className="flex items-center gap-1.5 font-mono text-[10.5px] text-(--ink-muted) uppercase">
						<StatusBars /> {formatEnumLabel(epub.status)}
					</span>
				)}
			</div>
			<div className="font-mono text-[10.5px] text-(--ink-muted)">
				{epub.createdAt.toLocaleDateString()}
			</div>
			<a
				href={epub.downloadUrl ?? undefined}
				aria-label={`Download ${epub.filename}`}
				className={`grid size-7 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink) ${
					epub.downloadUrl ? "" : "pointer-events-none opacity-30"
				}`}
			>
				<IconDownload className="size-3.5" />
			</a>
		</div>
	);
}
