import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authKeys } from "@/auth/auth.queries";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, signup } from "@/lib/api";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

const signupSchema = z.object({
	pseudo: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function SignupPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SignupFormValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: { pseudo: "", email: "", password: "" },
	});

	const mutation = useMutation({
		mutationFn: (values: SignupFormValues) =>
			signup({ ...values, permissions: [] }),
		onSuccess: (user) => {
			queryClient.setQueryData(authKeys.currentUser(), user);
			navigate({ to: "/" });
		},
	});

	return (
		<AuthCard
			tag="sign up"
			title="Create your account"
			subtitle="A few seconds, then straight to your library."
			footer={
				<>
					Already have an account?
					<Link
						to="/login"
						className="font-medium text-(--brand) hover:underline"
					>
						Sign in
					</Link>
				</>
			}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={handleSubmit((values) => mutation.mutate(values))}
			>
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
					{mutation.isPending ? "Creating account..." : "Create account"}
				</Button>
			</form>
		</AuthCard>
	);
}
