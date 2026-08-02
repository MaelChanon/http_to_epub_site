import { Link } from "@tanstack/react-router";

interface BreadcrumbItem {
	label: string;
	to?: string;
}

interface BreadcrumbsProps {
	items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
	return (
		<nav
			aria-label="Breadcrumb"
			className="flex items-center gap-2 font-mono text-[11px] tracking-[0.05em] text-(--ink-muted)"
		>
			{items.map((item, index) => (
				<span key={item.label} className="flex items-center gap-2">
					{index > 0 && <span className="opacity-40">/</span>}
					{item.to ? (
						<Link to={item.to} className="hover:text-(--ink)">
							{item.label}
						</Link>
					) : (
						<span className="text-(--ink)">{item.label}</span>
					)}
				</span>
			))}
		</nav>
	);
}
