import { useCallback, useRef } from "react";

export function useDebouncedCallback<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delayMs: number,
): (...args: Args) => void {
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	return useCallback(
		(...args: Args) => {
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(
				() => callbackRef.current(...args),
				delayMs,
			);
		},
		[delayMs],
	);
}
