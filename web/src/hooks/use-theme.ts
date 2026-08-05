import { useState } from "react";

const STORAGE_KEY = "manga-theme";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
	return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(readStoredTheme);

	function toggleTheme() {
		const next = theme === "dark" ? "light" : "dark";
		setTheme(next);
		document.documentElement.dataset.theme = next;
		localStorage.setItem(STORAGE_KEY, next);
	}

	return { theme, toggleTheme };
}
