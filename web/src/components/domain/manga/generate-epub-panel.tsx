import type { ChangeEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { IconBolt, IconClose, IconUpload } from "@/components/icons";
import type { Manga } from "@/lib/api";
import type { ChapterRange } from "./manga.util";
import { coverHue } from "./manga.util";

interface DimPreset {
	id: string;
	name: string;
	w: number | null;
	h: number | null;
}

const DIM_PRESETS: DimPreset[] = [
	{ id: "kindle", name: 'Kindle 6"', w: 600, h: 800 },
	{ id: "kobo", name: "Kobo Clara", w: 758, h: 1024 },
	{ id: "remarkable", name: "reMarkable", w: 1404, h: 1872 },
	{ id: "ipad-mini", name: "iPad mini", w: 1488, h: 2266 },
	{ id: "a5", name: "A5 print", w: 1240, h: 1748 },
	{ id: "custom", name: "Custom", w: null, h: null },
];

interface GenerateEpubPanelProps {
	manga: Manga;
	totalChapters: number;
	range: ChapterRange;
	onRangeChange: (range: ChapterRange) => void;
}

// TODO(epub): brancher sur l'endpoint de génération une fois qu'il existera —
// pour l'instant le bouton "Generate" ne fait rien de plus que loguer la payload.
export function GenerateEpubPanel({
	manga,
	totalChapters,
	range,
	onRangeChange,
}: GenerateEpubPanelProps) {
	const [dimId, setDimId] = useState("kobo");
	const [customW, setCustomW] = useState(800);
	const [customH, setCustomH] = useState(1200);
	const [cover, setCover] = useState<{ url: string; name: string } | null>(
		null,
	);
	const fileRef = useRef<HTMLInputElement>(null);

	const preset = DIM_PRESETS.find((p) => p.id === dimId) ?? DIM_PRESETS[0];
	const dims =
		dimId === "custom"
			? { w: customW, h: customH }
			: { w: preset.w ?? 0, h: preset.h ?? 0 };
	const chapterCount = Math.max(0, range.end - range.start + 1);
	const estimatedMb = Math.round((chapterCount * 0.85 + 2) * 10) / 10;
	const hue = coverHue(manga.id);

	const clampStart = (value: number) =>
		Math.max(1, Math.min(range.end, value || 1));
	const clampEnd = (value: number) =>
		Math.max(range.start, Math.min(totalChapters, value || totalChapters));

	function onFileChange(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		setCover((prev) => {
			if (prev) {
				URL.revokeObjectURL(prev.url);
			}
			return { url: URL.createObjectURL(file), name: file.name };
		});
	}

	function handleGenerate() {
		console.info("Generate EPUB", { range, dims, cover: cover?.name });
	}

	return (
		<aside className="h-fit self-start rounded-[10px] border border-(--line) bg-(--bg-elev) lg:sticky lg:top-24">
			<div className="flex items-center justify-between border-b border-(--line) px-4.5 py-3.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
				<span>[generate]</span>
				<b className="font-semibold text-(--brand) tracking-[-0.01em] normal-case">
					.epub
				</b>
			</div>

			<div className="flex flex-col gap-5 p-4.5">
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
						<span>chapter range</span>
						<b className="font-medium text-(--ink) normal-case">
							{chapterCount} ch
						</b>
					</div>
					<div className="grid grid-cols-[1fr_20px_1fr] items-center gap-2">
						<NumberField
							label="from"
							value={range.start}
							onChange={(v) =>
								onRangeChange({ ...range, start: clampStart(v) })
							}
							min={1}
							max={range.end}
						/>
						<span className="text-center font-mono text-(--ink-muted)">—</span>
						<NumberField
							label="to"
							value={range.end}
							onChange={(v) => onRangeChange({ ...range, end: clampEnd(v) })}
							min={range.start}
							max={totalChapters}
						/>
					</div>
					<div className="mt-1 flex flex-wrap gap-1">
						<QuickButton
							onClick={() => onRangeChange({ start: 1, end: totalChapters })}
						>
							All
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({ start: 1, end: Math.min(10, totalChapters) })
							}
						>
							First 10
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({
									start: Math.max(1, totalChapters - 9),
									end: totalChapters,
								})
							}
						>
							Last 10
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({
									start: 1,
									end: Math.min(Math.ceil(totalChapters / 4), totalChapters),
								})
							}
						>
							Vol. 1
						</QuickButton>
					</div>
					<div className="mt-0.5 font-mono text-[10.5px] text-(--ink-muted)">
						→{" "}
						<b className="font-semibold text-(--brand)">
							ch. {String(range.start).padStart(3, "0")}–
							{String(range.end).padStart(3, "0")}
						</b>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
						<span>page dimensions</span>
						<b className="font-medium text-(--ink) normal-case">
							{dims.w}×{dims.h}
						</b>
					</div>
					<div className="grid grid-cols-3 gap-1.5">
						{DIM_PRESETS.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => setDimId(p.id)}
								className={`flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left ${
									dimId === p.id
										? "border-(--brand) bg-(--brand-soft) text-(--ink)"
										: "border-(--line) bg-(--bg) text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
								}`}
							>
								<span className="text-[12px] font-medium tracking-[-0.01em]">
									{p.name}
								</span>
								<span className="font-mono text-[10px] text-(--ink-muted) tabular-nums">
									{p.w ? `${p.w}×${p.h}` : "w × h"}
								</span>
							</button>
						))}
					</div>
					{dimId === "custom" && (
						<div className="mt-1.5 grid grid-cols-[1fr_20px_1fr] items-center gap-1.5">
							<NumberField
								label="w"
								value={customW}
								onChange={(v) => setCustomW(v)}
								min={200}
								max={4000}
							/>
							<span className="text-center font-mono text-(--ink-muted)">
								×
							</span>
							<NumberField
								label="h"
								value={customH}
								onChange={(v) => setCustomH(v)}
								min={200}
								max={4000}
							/>
						</div>
					)}
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
						<span>custom cover</span>
						<b className="font-medium text-(--ink) normal-case">
							{cover ? "uploaded" : "optional"}
						</b>
					</div>
					<div className="grid grid-cols-[72px_1fr] items-stretch gap-3">
						<div
							className="relative aspect-2/3 overflow-hidden rounded-md border border-(--line)"
							style={
								cover
									? undefined
									: {
											backgroundImage: `repeating-linear-gradient(135deg, oklch(0.3 0.04 ${hue}) 0 6px, oklch(0.38 0.07 ${hue}) 6px 12px)`,
										}
							}
						>
							{cover ? (
								<img
									src={cover.url}
									alt="Aperçu de la couverture"
									className="size-full object-cover"
								/>
							) : (
								<div className="absolute inset-0 grid place-items-center px-1 text-center font-mono text-[9.5px] tracking-[0.06em] text-(--ink-muted) uppercase">
									default
									<br />
									stripe
								</div>
							)}
						</div>
						<div className="flex flex-col justify-center gap-1.5">
							<label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-(--line-strong) bg-(--bg) px-2.5 py-2 text-[12px] font-medium text-(--ink) hover:border-(--brand) hover:text-(--brand)">
								<IconUpload className="size-4" />
								<span>{cover ? "Replace" : "Upload image"}</span>
								<input
									ref={fileRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={onFileChange}
								/>
							</label>
							{cover && (
								<button
									type="button"
									onClick={() => setCover(null)}
									className="inline-flex items-center gap-1 px-1 text-left font-mono text-[11px] text-(--ink-muted) hover:text-(--ink)"
								>
									<IconClose />
									remove (
									{cover.name.length > 18
										? `${cover.name.slice(0, 16)}…`
										: cover.name}
									)
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2.5 border-t border-(--line) bg-(--bg-elev-2) px-4.5 py-3.5">
				<div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
					<span>est. size</span>
					<b className="font-medium text-(--ink) normal-case">
						~{estimatedMb} MB
					</b>
				</div>
				<button
					type="button"
					disabled={chapterCount === 0}
					onClick={handleGenerate}
					className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-(--brand) text-[13.5px] font-semibold tracking-[-0.01em] text-(--brand-contrast) hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
				>
					<IconBolt className="size-4" />
					Generate .epub
				</button>
			</div>
		</aside>
	);
}

function NumberField({
	label,
	value,
	onChange,
	min,
	max,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
}) {
	return (
		<div className="flex items-center overflow-hidden rounded-[6px] border border-(--line) bg-(--bg) focus-within:border-(--brand) focus-within:ring-3 focus-within:ring-(--brand-soft)">
			<div className="grid h-8 place-items-center border-r border-(--line) px-2 font-mono text-[10px] tracking-[0.06em] text-(--ink-muted) uppercase">
				{label}
			</div>
			<input
				type="number"
				min={min}
				max={max}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="h-8 min-w-0 flex-1 bg-transparent px-2 font-mono text-[13px] text-(--ink) tabular-nums outline-none"
			/>
		</div>
	);
}

function QuickButton({
	onClick,
	children,
}: {
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-[4px] border border-(--line) bg-(--bg) px-2 py-1 font-mono text-[10.5px] text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
		>
			{children}
		</button>
	);
}
