import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { AniListSearchBar } from "@/components/domain/manga/anilist-search-bar";
import { IconMoon, IconSun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
	const { theme, toggleTheme } = useTheme();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const search = useSearch({ strict: false });
	const favoritesOn = pathname === "/" && search.favorites === true;
	const { data: currentUser } = useQuery({
		queryKey: authKeys.currentUser(),
		queryFn: getCurrentUser,
	});

	return (
		<header className="sticky top-0 z-20 border-b border-(--line) bg-(--bg)">
			<div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-8">
				<Link
					to="/"
					className="flex shrink-0 items-center gap-2.5 font-mono text-[13px] font-medium whitespace-nowrap text-(--ink)"
				>
					<div className="grid size-7 place-items-center rounded-[7px] bg-(--ink) font-mono text-[11px] font-semibold text-(--bg)">
						h
					</div>
					<span className="hidden sm:inline">http</span>
					<span className="mx-0.5 hidden text-(--ink-muted) sm:inline">→</span>
					<span className="hidden sm:inline">epub</span>
				</Link>

				<nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
					<Link
						to="/"
						className={`shrink-0 rounded-md px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3 ${
							pathname === "/" && !favoritesOn
								? "bg-(--bg-elev-2) text-(--ink)"
								: "text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
						}`}
					>
						Browse
					</Link>
					<button
						type="button"
						disabled
						className="hidden shrink-0 cursor-not-allowed rounded-md px-2.5 py-2 text-[13px] font-medium text-(--ink-muted) opacity-50 sm:block sm:px-3"
					>
						Library
					</button>
					<Link
						to="/"
						search={{ favorites: true }}
						className={`shrink-0 rounded-md px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3 ${
							favoritesOn
								? "bg-(--bg-elev-2) text-(--ink)"
								: "text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
						}`}
					>
						Favorites
					</Link>
					{currentUser?.isAdmin && (
						<Link
							to="/admin/users"
							className={`shrink-0 rounded-md px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-3 ${
								pathname === "/admin/users"
									? "bg-(--bg-elev-2) text-(--ink)"
									: "text-(--ink-soft) hover:bg-(--bg-elev-2) hover:text-(--ink)"
							}`}
						>
							Admin
						</Link>
					)}
				</nav>

				<div className="ml-4 hidden flex-1 justify-center sm:flex">
					<AniListSearchBar />
				</div>

				<div className="ml-auto flex shrink-0 items-center gap-2">
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

			<div className="border-t border-(--line) px-4 py-2.5 sm:hidden">
				<AniListSearchBar />
			</div>
		</header>
	);
}
