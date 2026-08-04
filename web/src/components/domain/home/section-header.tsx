export function SectionHeader({
	num,
	title,
	sub,
}: {
	num: string;
	title: string;
	sub: string;
}) {
	return (
		<div className="mb-7 grid grid-cols-[auto_1fr_auto] items-end gap-6">
			<div className="flex min-w-[60px] flex-col gap-1 pt-1.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted)">
				<span>{num}</span>
			</div>
			<h2 className="text-[40px] leading-none font-medium tracking-[-0.035em] text-balance">
				{title}
			</h2>
			<span className="pb-1.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
				{sub}
			</span>
		</div>
	);
}
