import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { useCreateUser } from "@/components/domain/admin/admin.queries";
import { fullPermissionLabels } from "@/components/domain/admin/admin.util";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Permission } from "@/lib/api";
import { ApiError, Permission as PermissionSchema } from "@/lib/api";

const createUserSchema = z.object({
	pseudo: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function CreateUserDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CreateUserFormValues>({
		resolver: zodResolver(createUserSchema),
		defaultValues: { pseudo: "", email: "", password: "" },
	});

	const mutation = useCreateUser();

	function togglePermission(perm: Permission) {
		setPermissions((current) =>
			current.includes(perm)
				? current.filter((p) => p !== perm)
				: [...current, perm],
		);
	}

	function close(open: boolean) {
		if (!open) {
			reset();
			setPermissions([]);
			mutation.reset();
		}
		onOpenChange(open);
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a user</DialogTitle>
					<DialogDescription>
						Choose their name, email, password and permissions.
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex flex-col gap-3.5"
					onSubmit={handleSubmit((values) =>
						mutation.mutate(
							{ ...values, permissions },
							{ onSuccess: () => close(false) },
						),
					)}
				>
					<TextField
						id="pseudo"
						label="Name"
						type="text"
						placeholder="Their name"
						autoComplete="off"
						registration={register("pseudo")}
						error={errors.pseudo?.message}
					/>

					<TextField
						id="email"
						label="Email"
						type="email"
						placeholder="them@example.com"
						autoComplete="off"
						registration={register("email")}
						error={errors.email?.message}
					/>

					<PasswordField
						id="password"
						autoComplete="new-password"
						registration={register("password")}
						error={errors.password?.message}
					/>

					<div className="flex flex-col gap-1.5">
						<span className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
							Permissions
						</span>
						<div className="flex flex-col gap-1.5">
							{PermissionSchema.literals.map((perm) => {
								const active = permissions.includes(perm);
								return (
									<button
										key={perm}
										type="button"
										aria-pressed={active}
										onClick={() => togglePermission(perm)}
										className={`flex items-center gap-2.5 rounded-sm border px-3 py-2 text-left text-[13px] transition-colors ${
											active
												? "border-(--brand) bg-(--brand-soft) text-(--brand)"
												: "border-(--line) text-(--ink-soft) hover:border-(--line-strong)"
										}`}
									>
										<span
											className={`grid size-4.5 shrink-0 place-items-center rounded-[4px] border ${
												active
													? "border-(--brand) bg-(--brand) text-white"
													: "border-(--line-strong) text-transparent"
											}`}
										>
											<IconCheck className="size-3" />
										</span>
										{fullPermissionLabels[perm]}
									</button>
								);
							})}
						</div>
					</div>

					{mutation.isError && (
						<p role="alert" className="text-[13px] text-destructive">
							{mutation.error instanceof ApiError
								? mutation.error.message
								: "Something went wrong"}
						</p>
					)}

					<Button
						type="submit"
						disabled={mutation.isPending}
						className="mt-1 h-11 w-full rounded-sm bg-(--brand) text-sm text-(--brand-contrast) hover:bg-(--brand)/90"
					>
						{mutation.isPending ? "Creating user..." : "Create user"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
