import { useEffect, useState } from "react";

const STORAGE_KEY = "manga-theme";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
	return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(readStoredTheme);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		localStorage.setItem(STORAGE_KEY, theme);
	}, [theme]);

	function toggleTheme() {
		setTheme((current) => (current === "dark" ? "light" : "dark"));
	}

	return { theme, toggleTheme };
}
