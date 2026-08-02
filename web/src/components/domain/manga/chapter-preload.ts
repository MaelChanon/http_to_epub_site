import { useRef, useSyncExternalStore } from "react";

function loadImage(src: string) {
	return new Promise<void>((resolve) => {
		const img = new Image();
		img.onload = () => resolve();
		img.onerror = () => resolve();
		img.src = src;
	});
}

function createSequentialPreloader(urls: readonly string[]) {
	let loadedCount = 0;

	function subscribe(onChange: () => void) {
		let cancelled = false;

		(async () => {
			for (let i = 0; i < urls.length; i++) {
				await loadImage(urls[i]);
				if (cancelled) {
					return;
				}
				loadedCount = i + 1;
				onChange();
			}
		})();

		return () => {
			cancelled = true;
		};
	}

	function getSnapshot() {
		return loadedCount;
	}

	return { subscribe, getSnapshot };
}

/**
 * Preloads `urls` strictly in order (page 1 before page 2, etc.) and
 * returns how many of them, counted from the start, are ready to display.
 */
export function useSequentialPreload(urls: readonly string[]) {
	const ref = useRef<{
		urls: readonly string[];
		preloader: ReturnType<typeof createSequentialPreloader>;
	}>(null);

	if (!ref.current || ref.current.urls !== urls) {
		ref.current = { urls, preloader: createSequentialPreloader(urls) };
	}

	return useSyncExternalStore(
		ref.current.preloader.subscribe,
		ref.current.preloader.getSnapshot,
	);
}
