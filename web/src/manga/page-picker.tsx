import { useState } from "react";
import { IconGrid } from "@/components/icons";

interface PagePickerProps {
	total: number;
	loadedCount: number;
	current: number;
	onSelect: (index: number) => void;
}

export function PagePicker({
	total,
	loadedCount,
	current,
	onSelect,
}: PagePickerProps) {
	const [open, setOpen] = useState(false);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				disabled={total === 0}
				aria-label="Jump to page"
				className={`grid size-8 place-items-center rounded-md border text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink) disabled:opacity-40 ${
					open ? "border-(--brand) text-(--ink)" : "border-(--line)"
				}`}
			>
				<IconGrid />
			</button>

			{open && (
				<>
					<button
						type="button"
						aria-label="Close page picker"
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-30 cursor-default"
					/>
					<div className="absolute top-[calc(100%+6px)] right-0 z-40 max-h-[360px] w-[280px] overflow-y-auto rounded-[10px] border border-(--line) bg-(--bg-elev) p-2.5 shadow-(--shadow-lg)">
						<div className="mb-2 px-0.5 font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
							{loadedCount < total
								? `loading ${loadedCount}/${total}…`
								: `${total} pages`}
						</div>
						<div className="grid grid-cols-6 gap-1.5">
							{Array.from({ length: total }, (_, i) => i).map((i) => {
								const loaded = i < loadedCount;
								const active = i === current;
								return (
									<button
										key={i}
										type="button"
										disabled={!loaded}
										onClick={() => {
											onSelect(i);
											setOpen(false);
										}}
										className={`rounded-md py-1.5 text-center font-mono text-[11px] tabular-nums ${
											active
												? "bg-(--brand) font-semibold text-(--brand-contrast)"
												: loaded
													? "bg-(--bg-elev-2) text-(--ink-soft) hover:text-(--ink)"
													: "text-(--ink-muted) opacity-40"
										}`}
									>
										{i + 1}
									</button>
								);
							})}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
