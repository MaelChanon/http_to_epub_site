import type * as React from "react";

type IconProps = React.ComponentProps<"svg">;

const base = {
	width: 16,
	height: 16,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.8,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
};

export function IconEye(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

export function IconEyeOff(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	);
}

export function IconSun(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
		</svg>
	);
}

export function IconMoon(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}

export function IconArrowLeft(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<line x1="19" y1="12" x2="5" y2="12" />
			<polyline points="12 19 5 12 12 5" />
		</svg>
	);
}

export function IconRefresh(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<polyline points="23 4 23 10 17 10" />
			<polyline points="1 20 1 14 7 14" />
			<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
		</svg>
	);
}

export function IconChevronRight(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<polyline points="9 6 15 12 9 18" />
		</svg>
	);
}

export function IconUpload(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	);
}

export function IconBolt(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
		</svg>
	);
}

export function IconGrid(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
	);
}

export function IconClose(props: IconProps) {
	return (
		<svg
			aria-hidden="true"
			{...base}
			width={14}
			height={14}
			strokeWidth={2}
			{...props}
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
