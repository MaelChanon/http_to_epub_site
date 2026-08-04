import { IconClose, IconSearch } from "@/components/icons";

export function BrowseSearchInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="relative">
			<span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--ink-muted)">
				<IconSearch />
			</span>
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search your library by title…"
				className="h-[46px] w-full rounded-[10px] border border-(--line) bg-(--bg-elev) pr-11 pl-11 text-[15px] text-(--ink) outline-none placeholder:text-(--ink-muted) focus:border-(--brand) focus:ring-3 focus:ring-(--brand-soft)"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear search"
					className="absolute top-1/2 right-2.5 grid size-6.5 -translate-y-1/2 place-items-center rounded-md bg-(--bg-elev-2) text-(--ink-muted) hover:text-(--ink)"
				>
					<IconClose />
				</button>
			)}
		</div>
	);
}
