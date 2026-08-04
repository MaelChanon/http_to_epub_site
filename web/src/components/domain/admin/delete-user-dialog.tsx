import { useDeleteUser } from "@/components/domain/admin/admin.queries";
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

export function DeleteUserDialog({
	user,
	onOpenChange,
}: {
	user: User | undefined;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useDeleteUser();

	return (
		<Dialog open={!!user} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete {user?.pseudo}?</DialogTitle>
					<DialogDescription>
						This permanently removes their account, favorites and permissions.
						This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={mutation.isPending}
						onClick={() => {
							if (!user) {
								return;
							}
							mutation.mutate(user, { onSuccess: () => onOpenChange(false) });
						}}
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
