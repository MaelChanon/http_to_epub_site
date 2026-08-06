interface NumberFieldProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
}

export function NumberField({
	label,
	value,
	onChange,
	min,
	max,
}: NumberFieldProps) {
	return (
		<div className="flex items-center overflow-hidden rounded-[6px] border border-(--line) bg-(--bg) focus-within:border-(--brand) focus-within:ring-3 focus-within:ring-(--brand-soft)">
			<div className="grid h-8 place-items-center border-r border-(--line) px-2 font-mono text-[10px] tracking-[0.06em] text-(--ink-muted) uppercase">
				{label}
			</div>
			<input
				type="number"
				min={min}
				max={max}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="h-8 min-w-0 flex-1 bg-transparent px-2 font-mono text-[13px] text-(--ink) tabular-nums outline-none"
			/>
		</div>
	);
}
