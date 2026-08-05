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
		<div className="mb-5 grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-1 sm:mb-7 sm:grid-cols-[auto_1fr_auto] sm:gap-6">
			<div className="flex min-w-[44px] flex-col gap-1 pt-1.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) sm:min-w-[60px]">
				<span>{num}</span>
			</div>
			<h2 className="text-[26px] leading-none font-medium tracking-[-0.03em] text-balance sm:text-[40px] sm:tracking-[-0.035em]">
				{title}
			</h2>
			<span className="col-span-2 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase sm:col-span-1 sm:pb-1.5">
				{sub}
			</span>
		</div>
	);
}
