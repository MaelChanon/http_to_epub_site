import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const accountSchema = z.object({
	pseudo: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountFormProps {
	submitLabel: string;
	pendingLabel: string;
	isPending: boolean;
	error?: string;
	onSubmit: (values: AccountFormValues) => void;
}

export function AccountForm({
	submitLabel,
	pendingLabel,
	isPending,
	error,
	onSubmit,
}: AccountFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<AccountFormValues>({
		resolver: zodResolver(accountSchema),
		defaultValues: { pseudo: "", email: "", password: "" },
	});

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
			<TextField
				id="name"
				label="Name"
				type="text"
				placeholder="Your name"
				autoComplete="name"
				registration={register("pseudo")}
				error={errors.pseudo?.message}
			/>

			<TextField
				id="email"
				label="Email"
				type="email"
				placeholder="you@example.com"
				autoComplete="email"
				registration={register("email")}
				error={errors.email?.message}
			/>

			<div className="flex flex-col gap-[7px]">
				<Label
					htmlFor="password"
					className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase"
				>
					Password
				</Label>
				<PasswordField
					id="password"
					autoComplete="new-password"
					registration={register("password")}
					error={errors.password?.message}
				/>
			</div>

			{error && (
				<p role="alert" className="text-[13px] text-destructive">
					{error}
				</p>
			)}

			<Button
				type="submit"
				disabled={isPending}
				className="mt-1 h-11 w-full rounded-sm bg-(--brand) text-sm text-(--brand-contrast) hover:bg-(--brand)/90"
			>
				{isPending ? pendingLabel : submitLabel}
			</Button>
		</form>
	);
}
