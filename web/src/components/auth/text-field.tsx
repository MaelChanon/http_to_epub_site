import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TextFieldProps {
	id: string;
	label: string;
	type: "text" | "email";
	placeholder: string;
	autoComplete: string;
	registration: UseFormRegisterReturn;
	error?: string;
}

export function TextField({
	id,
	label,
	type,
	placeholder,
	autoComplete,
	registration,
	error,
}: TextFieldProps) {
	return (
		<div className="flex flex-col gap-[7px]">
			<Label
				htmlFor={id}
				className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase"
			>
				{label}
			</Label>
			<Input
				id={id}
				type={type}
				placeholder={placeholder}
				autoComplete={autoComplete}
				aria-invalid={!!error}
				className="h-[42px] rounded-sm px-3.5 text-sm"
				{...registration}
			/>
			{error && (
				<p role="alert" className="text-[12px] text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
