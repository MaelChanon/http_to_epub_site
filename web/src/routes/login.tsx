import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

const loginSchema = z.object({
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPage() {
	const navigate = useNavigate();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	const mutation = useMutation({
		mutationFn: login,
		onSuccess: () => navigate({ to: "/" }),
	});

	return (
		<AuthCard
			tag="sign in"
			title="Welcome back"
			subtitle="Sign in to reach your library and favorites."
			footer={
				<>
					Don't have an account?
					<Link
						to="/signup"
						className="font-medium text-(--brand) hover:underline"
					>
						Sign up
					</Link>
				</>
			}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
			>
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
					<div className="flex items-center justify-between">
						<Label
							htmlFor="password"
							className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase"
						>
							Password
						</Label>
						<button
							type="button"
							className="text-[11.5px] text-(--brand) hover:underline"
						>
							Forgot password?
						</button>
					</div>
					<PasswordField
						id="password"
						autoComplete="current-password"
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
					{mutation.isPending ? "Signing in..." : "Sign in"}
				</Button>
			</form>
		</AuthCard>
	);
}
