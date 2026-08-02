import { Link, useRouterState } from "@tanstack/react-router";
import { IconMoon, IconSun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
	const { theme, toggleTheme } = useTheme();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<header className="sticky top-0 z-20 border-b border-(--line) bg-(--bg)">
			<div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-8">
				<Link
					to="/"
					className="flex items-center gap-2.5 font-mono text-[13px] font-medium whitespace-nowrap text-(--ink)"
				>
					<div className="grid size-7 place-items-center rounded-[7px] bg-(--ink) font-mono text-[11px] font-semibold text-(--bg)">
						h
					</div>
					<span>http</span>
					<span className="mx-0.5 text-(--ink-muted)">→</span>
					<span>epub</span>
				</Link>

				<nav className="flex items-center gap-0.5">
					<Link
						to="/"
						className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
							pathname === "/"
								? "bg-(--bg-elev-2) text-(--ink)"
								: "text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
						}`}
					>
						Browse
					</Link>
					<button
						type="button"
						disabled
						className="cursor-not-allowed rounded-md px-3 py-2 text-[13px] font-medium text-(--ink-muted) opacity-50"
					>
						Library
					</button>
					<button
						type="button"
						disabled
						className="cursor-not-allowed rounded-md px-3 py-2 text-[13px] font-medium text-(--ink-muted) opacity-50"
					>
						Favorites
					</button>
				</nav>

				<div className="ml-auto flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						aria-label="Toggle theme"
						className="size-9 rounded-sm border-(--line) bg-(--bg-elev) text-(--ink-soft) hover:border-(--line-strong) hover:bg-(--bg-elev-2) hover:text-(--ink-soft)"
					>
						{theme === "dark" ? <IconSun /> : <IconMoon />}
					</Button>
				</div>
			</div>
		</header>
	);
}
