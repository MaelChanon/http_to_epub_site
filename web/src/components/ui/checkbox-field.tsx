import type { UseFormRegisterReturn } from "react-hook-form";

interface CheckboxFieldProps {
	label: string;
	registration: UseFormRegisterReturn;
}

export function CheckboxField({ label, registration }: CheckboxFieldProps) {
	return (
		<label className="flex items-center gap-2">
			<input
				type="checkbox"
				className="size-4 accent-(--brand)"
				{...registration}
			/>
			<span className="text-[12.5px] text-(--ink)">{label}</span>
		</label>
	);
}
