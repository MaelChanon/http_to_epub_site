import type { ReactNode } from "react";

interface QuickButtonProps {
	onClick: () => void;
	children: ReactNode;
}

export function QuickButton({ onClick, children }: QuickButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-[4px] border border-(--line) bg-(--bg) px-2 py-1 font-mono text-[10.5px] text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
		>
			{children}
		</button>
	);
}
