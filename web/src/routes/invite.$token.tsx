import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authKeys } from "@/auth/auth.queries";
import { AccountForm } from "@/components/auth/account-form";
import { AuthCard } from "@/components/auth/auth-card";
import { ApiError, acceptInvite } from "@/lib/api";

export const Route = createFileRoute("/invite/$token")({
	component: InvitePage,
});

function InvitePage() {
	const { token } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (values: { pseudo: string; email: string; password: string }) =>
			acceptInvite(token, values),
		onSuccess: (user) => {
			queryClient.setQueryData(authKeys.currentUser(), user);
			navigate({ to: "/" });
		},
	});

	return (
		<AuthCard
			tag="invite"
			title="Set up your account"
			subtitle="Pick a name, an email and a password. That's it."
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
			<AccountForm
				submitLabel="Create account"
				pendingLabel="Creating account..."
				isPending={mutation.isPending}
				error={
					mutation.isError
						? mutation.error instanceof ApiError
							? mutation.error.message
							: "Something went wrong"
						: undefined
				}
				onSubmit={(values) => mutation.mutate(values)}
			/>
		</AuthCard>
	);
}
