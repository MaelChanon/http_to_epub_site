import { useCreatePasswordReset } from "@/components/domain/admin/admin.queries";
import { MagicLinkResult } from "@/components/domain/admin/magic-link-result";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@/lib/api";
import { ApiError } from "@/lib/api";

export function ResetLinkDialog({
	user,
	onOpenChange,
}: {
	user: User | undefined;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useCreatePasswordReset();

	function close(next: boolean) {
		if (!next) {
			mutation.reset();
		}
		onOpenChange(next);
	}

	return (
		<Dialog open={!!user} onOpenChange={close}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Reset {user?.pseudo}'s password</DialogTitle>
					<DialogDescription>
						{mutation.data
							? "Send them this link. Using it signs them out of every session."
							: "This creates a one-hour link that lets them choose a new password."}
					</DialogDescription>
				</DialogHeader>

				{mutation.data ? (
					<div className="flex flex-col gap-3.5">
						<MagicLinkResult
							path="/reset-password"
							token={mutation.data.token}
							expiresInSeconds={mutation.data.expiresInSeconds}
						/>
						<DialogFooter>
							<Button type="button" onClick={() => close(false)}>
								Done
							</Button>
						</DialogFooter>
					</div>
				) : (
					<>
						{mutation.isError && (
							<p role="alert" className="text-[13px] text-destructive">
								{mutation.error instanceof ApiError
									? mutation.error.message
									: "Something went wrong"}
							</p>
						)}
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => close(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={mutation.isPending}
								onClick={() => {
									if (!user) {
										return;
									}
									mutation.mutate(user);
								}}
							>
								{mutation.isPending ? "Creating link..." : "Create reset link"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
