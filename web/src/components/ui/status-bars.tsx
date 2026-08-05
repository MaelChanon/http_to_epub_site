import { cn } from "@/lib/utils";

const BARS = [0, 1, 2];

export function StatusBars({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn("inline-flex h-3 items-end gap-[2px]", className)}
		>
			{BARS.map((i) => (
				<span
					key={i}
					className="w-[3px] origin-bottom rounded-[1px] bg-(--brand)"
					style={{
						height: "100%",
						animation: "status-bars-pulse 0.9s ease-in-out infinite",
						animationDelay: `${i * 0.15}s`,
					}}
				/>
			))}
		</span>
	);
}
