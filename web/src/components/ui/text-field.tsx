import type { UseFormRegisterReturn } from "react-hook-form";

interface TextFieldProps {
	label: string;
	placeholder?: string;
	registration: UseFormRegisterReturn;
	error?: string;
}

export function TextField({
	label,
	placeholder,
	registration,
	error,
}: TextFieldProps) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
				{label}
			</span>
			<input
				type="text"
				placeholder={placeholder}
				className="h-9 rounded-md border border-(--line) bg-(--bg) px-2.5 text-[13px] text-(--ink) outline-none focus:border-(--brand)"
				{...registration}
			/>
			{error && <span className="text-[11px] text-destructive">{error}</span>}
		</label>
	);
}
