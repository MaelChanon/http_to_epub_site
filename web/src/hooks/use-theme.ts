import { useState } from "react";

const STORAGE_KEY = "manga-theme";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
	return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(readStoredTheme);

	function toggleTheme() {
		setTheme((current) => (current === "dark" ? "light" : "dark"));
		document.documentElement.dataset.theme = theme;
		localStorage.setItem(STORAGE_KEY, theme);
	}

	return { theme, toggleTheme };
}
