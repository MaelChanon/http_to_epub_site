import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { IconEye, IconEyeOff } from "@/components/icons";
import { Input } from "@/components/ui/input";

interface PasswordFieldProps {
	id: string;
	autoComplete: "current-password" | "new-password";
	registration: UseFormRegisterReturn;
	error?: string;
}

export function PasswordField({
	id,
	autoComplete,
	registration,
	error,
}: PasswordFieldProps) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="flex flex-col gap-[7px]">
			<div className="relative">
				<Input
					id={id}
					type={visible ? "text" : "password"}
					placeholder="••••••••••"
					autoComplete={autoComplete}
					aria-invalid={!!error}
					className="h-[42px] rounded-sm pr-[42px] pl-3.5 text-sm"
					{...registration}
				/>
				<button
					type="button"
					onClick={() => setVisible((v) => !v)}
					aria-label="Toggle password visibility"
					className="absolute top-1 right-1 grid size-[34px] place-items-center rounded-sm text-(--ink-muted) hover:bg-(--bg-elev-2) hover:text-(--ink-soft)"
				>
					{visible ? <IconEyeOff /> : <IconEye />}
				</button>
			</div>
			{error && (
				<p role="alert" className="text-[12px] text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
