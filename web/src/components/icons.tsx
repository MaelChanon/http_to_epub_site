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

export function IconDownload(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
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

export function IconPlus(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

export function IconExternalLink(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			<polyline points="15 3 21 3 21 9" />
			<line x1="10" y1="14" x2="21" y2="3" />
		</svg>
	);
}

export function IconCheck(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

export function IconHeart(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
		</svg>
	);
}

export function IconSearch(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.3-4.3" />
		</svg>
	);
}

export function IconList(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
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

export function IconAlertTriangle(props: IconProps) {
	return (
		<svg aria-hidden="true" {...base} {...props}>
			<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	);
}
