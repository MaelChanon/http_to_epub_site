import { Link } from "@tanstack/react-router";
import type * as React from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

interface AuthCardProps {
	tag: string;
	title: string;
	subtitle: string;
	children: React.ReactNode;
	footer: React.ReactNode;
}

export function AuthCard({
	tag,
	title,
	subtitle,
	children,
	footer,
}: AuthCardProps) {
	const { theme, toggleTheme } = useTheme();

	return (
		<div className="relative grid min-h-screen place-items-center p-6">
			<Button
				type="button"
				variant="outline"
				size="icon"
				onClick={toggleTheme}
				aria-label="Toggle theme"
				className="fixed top-5 right-5 size-9 rounded-sm border-(--line) bg-(--bg-elev) text-(--ink-soft) hover:border-(--line-strong) hover:bg-(--bg-elev-2) hover:text-(--ink-soft)"
			>
				{theme === "dark" ? <IconSun /> : <IconMoon />}
			</Button>

			<div className="flex w-full max-w-[400px] flex-col gap-[26px] rounded-[16px] border border-(--line) bg-(--bg-elev) px-8 py-9 shadow-(--shadow-lg)">
				<Link
					to="/"
					className="flex items-center justify-center gap-2.5 font-mono text-[13px] font-medium text-(--ink-soft)"
				>
					<div className="grid size-7 place-items-center rounded-[7px] bg-(--ink) font-mono text-[11px] font-semibold text-(--bg)">
						h
					</div>
					<span>http</span>
					<span className="mx-0.5 text-(--ink-muted)">→</span>
					<span>epub</span>
				</Link>

				<div className="flex flex-col gap-1.5 text-center">
					<div className="font-mono text-[10.5px] tracking-[0.08em] text-(--brand) uppercase">
						[{tag}]
					</div>
					<h1 className="text-[24px] font-semibold tracking-[-0.02em] text-(--ink-soft)">
						{title}
					</h1>
					<p className="text-[13.5px] leading-normal text-(--ink-soft)">
						{subtitle}
					</p>
				</div>

				{children}

				<div className="flex justify-center gap-1.5 text-center text-[13px] text-(--ink-muted)">
					{footer}
				</div>
			</div>
		</div>
	);
}
