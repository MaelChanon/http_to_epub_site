import { zodResolver } from "@hookform/resolvers/zod";
import type { UploadEpubCoverPayload } from "@workspace/api";
import { EpubCoverContentType } from "@workspace/api";
import { Schema } from "effect";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { IconBolt } from "@/components/icons";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { NumberField } from "@/components/ui/number-field";
import { QuickButton } from "@/components/ui/quick-button";
import { TextField } from "@/components/ui/text-field";
import type { Manga, MangaProviderName } from "@/lib/api";
import { useGenerateEpub } from "./epub.queries";
import type { ChapterRange } from "./manga.util";
import { coverHue, displayTitle, formatEnumLabel } from "./manga.util";
import { useMangaProviders } from "./scanProvider.queries";

const MAX_COVER_BYTES = 8 * 1024 * 1024;

const isEpubCoverContentType = Schema.is(EpubCoverContentType);

function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			if (typeof reader.result !== "string") {
				reject(
					new Error("Échec de la lecture du fichier : résultat non valide."),
				);
				return;
			}

			const commaIndex = reader.result.indexOf(",");
			if (commaIndex === -1) {
				reject(new Error("Format Data URL invalide (aucune virgule trouvée)."));
				return;
			}

			resolve(reader.result.slice(commaIndex + 1));
		};

		reader.onerror = () => {
			reject(
				reader.error ?? new Error("Erreur lors de la lecture du fichier."),
			);
		};

		reader.readAsDataURL(file);
	});
}

const DIM_PRESETS = [
	{ id: "kindle", name: 'Kindle 6"', w: 600, h: 800 },
	{ id: "kobo", name: "Kobo Libra", w: 1264, h: 1680 },
	{ id: "remarkable", name: "reMarkable", w: 1404, h: 1872 },
	{ id: "ipad-mini", name: "iPad mini", w: 1488, h: 2266 },
	{ id: "a5", name: "A5 print", w: 1240, h: 1748 },
	{ id: "custom", name: "Custom", w: null, h: null },
];

const generateFormSchema = z.object({
	creator: z.string(),
	filename: z.string().min(1, "Required"),
	splitDoublePage: z.boolean(),
});

type GenerateFormValues = z.infer<typeof generateFormSchema>;

interface GenerateEpubPanelProps {
	manga: Manga;
	totalChapters: number;
	range: ChapterRange;
	onRangeChange: (range: ChapterRange) => void;
}

export function GenerateEpubPanel({
	manga,
	totalChapters,
	range,
	onRangeChange,
}: GenerateEpubPanelProps) {
	const { data: providers = [] } = useMangaProviders(manga.mangaId);
	const [provider, setProvider] = useState<MangaProviderName>();
	const [dimId, setDimId] = useState("kobo");
	const [customW, setCustomW] = useState(800);
	const [customH, setCustomH] = useState(1200);
	const hue = coverHue(manga.id);

	const coverInputRef = useRef<HTMLInputElement>(null);
	const [cover, setCover] = useState<UploadEpubCoverPayload | null>(null);
	const [coverError, setCoverError] = useState<string>();

	async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) {
			return;
		}

		setCoverError(undefined);

		const contentType = file.type;
		if (!isEpubCoverContentType(contentType)) {
			setCoverError("Use a JPEG, PNG or WebP image");
			return;
		}

		if (file.size > MAX_COVER_BYTES) {
			setCoverError("Image is too large (max 8 MB)");
			return;
		}

		setCover(null);

		try {
			const data = await readFileAsBase64(file);
			setCover({
				contentType,
				data,
			});
		} catch {
			setCoverError("Failed to upload cover");
		}
	}

	useEffect(() => {
		if (provider && providers.some((p) => p.provider === provider)) {
			return;
		}
		setProvider(providers[0]?.provider);
	}, [provider, providers]);

	const activeProvider = providers.find((p) => p.provider === provider);
	const providerChapterCount = activeProvider
		? activeProvider.chapters.reduce((max, c) => Math.max(max, c.number), 0)
		: totalChapters;

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<GenerateFormValues>({
		resolver: zodResolver(generateFormSchema),
		defaultValues: {
			creator: manga.staff[0] ? manga.staff[0].name : "",
			filename: displayTitle(manga),
			splitDoublePage: false,
		},
	});

	const generateMutation = useGenerateEpub(
		manga.mangaId,
		provider ?? "SUSHISCAN",
	);

	const preset = DIM_PRESETS.find((p) => p.id === dimId) ?? DIM_PRESETS[0];
	const dims =
		dimId === "custom"
			? { w: customW, h: customH }
			: { w: preset.w ?? 0, h: preset.h ?? 0 };
	const chapterCount = Math.max(0, range.end - range.start + 1);

	const clampStart = (value: number) =>
		Math.max(1, Math.min(range.end, value || 1));
	const clampEnd = (value: number) =>
		Math.max(
			range.start,
			Math.min(providerChapterCount, value || providerChapterCount),
		);

	function onSubmit(values: GenerateFormValues) {
		if (!provider) {
			return;
		}
		generateMutation.mutate({
			chapterStart: range.start,
			chapterEnd: range.end,
			width: dims.w,
			height: dims.h,
			splitDoublePage: values.splitDoublePage,
			creator: values.creator.trim() || undefined,
			filename: values.filename,
			...(cover ? { cover } : {}),
		});
	}

	return (
		<aside className="h-fit rounded-[10px] border border-(--line) bg-(--bg-elev) lg:sticky lg:top-24">
			<div className="flex items-center justify-between border-b border-(--line) px-4.5 py-3.5 font-mono text-[11px] tracking-[0.08em] text-(--ink-muted) uppercase">
				<span>[generate]</span>
				<b className="font-semibold text-(--brand) tracking-[-0.01em] normal-case">
					.epub
				</b>
			</div>

			<form
				onSubmit={handleSubmit(onSubmit)}
				className="flex flex-col gap-5 p-4.5"
			>
				{providers.length > 1 && (
					<div className="flex flex-col gap-2">
						<div className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
							provider
						</div>
						<div className="flex flex-wrap gap-1.5">
							{providers.map((p) => (
								<button
									key={p.provider}
									type="button"
									onClick={() => setProvider(p.provider)}
									className={`rounded-md border px-2.5 py-1.5 text-[12px] font-medium ${
										provider === p.provider
											? "border-(--brand) bg-(--brand-soft) text-(--ink)"
											: "border-(--line) bg-(--bg) text-(--ink-soft) hover:border-(--line-strong) hover:text-(--ink)"
									}`}
								>
									{formatEnumLabel(p.provider)}
								</button>
							))}
						</div>
					</div>
				)}

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
							max={providerChapterCount}
						/>
					</div>
					<div className="mt-1 flex flex-wrap gap-1">
						<QuickButton
							onClick={() =>
								onRangeChange({ start: 1, end: providerChapterCount })
							}
						>
							All
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({
									start: 1,
									end: Math.min(10, providerChapterCount),
								})
							}
						>
							First 10
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({
									start: Math.max(1, providerChapterCount - 9),
									end: providerChapterCount,
								})
							}
						>
							Last 10
						</QuickButton>
						<QuickButton
							onClick={() =>
								onRangeChange({
									start: 1,
									end: Math.min(
										Math.ceil(providerChapterCount / 4),
										providerChapterCount,
									),
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
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => coverInputRef.current?.click()}
							className="relative aspect-2/3 w-14 shrink-0 overflow-hidden rounded-md border border-(--line)"
							style={
								cover
									? undefined
									: {
											backgroundImage: `repeating-linear-gradient(135deg, oklch(0.3 0.04 ${hue}) 0 6px, oklch(0.38 0.07 ${hue}) 6px 12px)`,
										}
							}
						>
							{cover && (
								<img
									src={`data:image/png;base64, ${cover.data}`}
									alt="Cover preview"
									className="size-full object-cover"
								/>
							)}
						</button>
						<div className="flex min-w-0 flex-col gap-1">
							<div className="flex flex-wrap gap-1.5">
								<QuickButton onClick={() => coverInputRef.current?.click()}>
									{cover ? "Change cover" : "Upload cover"}
								</QuickButton>
								{cover && (
									<QuickButton onClick={() => setCover(null)}>
										Remove
									</QuickButton>
								)}
							</div>
							{coverError && (
								<span className="font-mono text-[10.5px] text-destructive">
									{coverError}
								</span>
							)}
						</div>
						<input
							ref={coverInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onChange={handleCoverChange}
							className="hidden"
						/>
					</div>
					<TextField
						label="author"
						placeholder={manga.titleNative}
						registration={register("creator")}
					/>

					<TextField
						label="filename"
						placeholder="my-epub"
						registration={register("filename")}
						error={errors.filename?.message}
					/>

					<CheckboxField
						label="Split double pages"
						registration={register("splitDoublePage")}
					/>
				</div>
			</form>

			<div className="flex flex-col gap-2.5 border-t border-(--line) bg-(--bg-elev-2) px-4.5 py-3.5">
				{generateMutation.isSuccess && (
					<p className="font-mono text-[10.5px] text-(--brand)">
						Queued — check your library.
					</p>
				)}
				{generateMutation.isError && (
					<p className="font-mono text-[10.5px] text-destructive">
						{generateMutation.error instanceof Error
							? generateMutation.error.message
							: "Something went wrong"}
					</p>
				)}
				<button
					type="button"
					disabled={
						chapterCount === 0 || !provider || generateMutation.isPending
					}
					onClick={handleSubmit(onSubmit)}
					className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-(--brand) text-[13.5px] font-semibold tracking-[-0.01em] text-(--brand-contrast) hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
				>
					<IconBolt className="size-4" />
					{generateMutation.isPending ? "Generating…" : "Generate .epub"}
				</button>
			</div>
		</aside>
	);
}
