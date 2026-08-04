import type { ReactNode } from "react";

export function MangaGrid({
	view,
	children,
}: {
	view: "grid" | "list";
	children: ReactNode;
}) {
	return (
		<div
			className={
				view === "list"
					? "mt-7 flex flex-col gap-3"
					: "mt-7 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-5"
			}
		>
			{children}
		</div>
	);
}
