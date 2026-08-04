export function LoadingRow({ label = "loading…" }: { label?: string }) {
	return (
		<p className="py-10 text-center font-mono text-[12px] text-(--ink-muted)">
			{label}
		</p>
	);
}

export function ErrorRow({ message }: { message?: string }) {
	return (
		<div className="py-10 text-center">
			<h3 className="text-[15px] font-semibold text-(--ink)">
				Something went wrong
			</h3>
			<p className="mt-1 text-[13px] text-(--ink-muted)">
				{message ?? "Please try again."}
			</p>
		</div>
	);
}

export function EmptyState({ title, body }: { title: string; body: string }) {
	return (
		<div className="mt-7 rounded-[16px] border border-dashed border-(--line-strong) px-5 py-15 text-center text-(--ink-muted)">
			<h3 className="mb-1.5 text-[16px] text-(--ink)">{title}</h3>
			<p className="text-[13px]">{body}</p>
		</div>
	);
}
