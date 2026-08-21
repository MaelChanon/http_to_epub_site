import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { adminKeys } from "@/components/domain/admin/admin.queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, getPasswordReset, resetPassword } from "@/lib/api";
import { Password } from "@/lib/form-schema";

export const Route = createFileRoute("/reset-password/$token")({
	component: ResetPasswordPage,
});

const resetSchema = Schema.Struct({
	password: Password,
});

type ResetFormValues = typeof resetSchema.Type;

function ResetPasswordPage() {
	const { token } = Route.useParams();
	const navigate = useNavigate();

	const preview = useQuery({
		queryKey: adminKeys.passwordReset(token),
		queryFn: () => getPasswordReset(token),
		retry: false,
	});

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ResetFormValues>({
		resolver: effectTsResolver(resetSchema),
		defaultValues: { password: "" },
	});

	const mutation = useMutation({
		mutationFn: (values: ResetFormValues) =>
			resetPassword(token, values.password),
		onSuccess: () => navigate({ to: "/login" }),
	});

	if (preview.isPending) {
		return (
			<AuthCard
				tag="reset"
				title="Checking your link"
				subtitle="One moment."
				footer={null}
			>
				<p className="text-center font-mono text-[12px] text-(--ink-muted)">
					loading…
				</p>
			</AuthCard>
		);
	}

	if (preview.isError) {
		return (
			<AuthCard
				tag="reset"
				title="This link no longer works"
				subtitle="Reset links expire after an hour and can only be used once. Ask an administrator for a new one."
				footer={
					<Link
						to="/login"
						className="font-medium text-(--brand) hover:underline"
					>
						Back to sign in
					</Link>
				}
			>
				{null}
			</AuthCard>
		);
	}

	return (
		<AuthCard
			tag="reset"
			title={`New password for ${preview.data.pseudo}`}
			subtitle="Choosing a new password signs you out everywhere else."
			footer={
				<Link
					to="/login"
					className="font-medium text-(--brand) hover:underline"
				>
					Back to sign in
				</Link>
			}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
			>
				<div className="flex flex-col gap-[7px]">
					<Label
						htmlFor="password"
						className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase"
					>
						New password
					</Label>
					<PasswordField
						id="password"
						autoComplete="new-password"
						registration={register("password")}
						error={errors.password?.message}
					/>
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
					{mutation.isPending ? "Saving..." : "Set new password"}
				</Button>
			</form>
		</AuthCard>
	);
}
