import { useDeleteEpub } from "@/components/domain/manga/epub.queries";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Epub } from "@/lib/api";

export function DeleteEpubDialog({
	epub,
	onOpenChange,
}: {
	epub: Epub | undefined;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useDeleteEpub();

	return (
		<Dialog open={!!epub} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete {epub?.filename}.epub?</DialogTitle>
					<DialogDescription>
						This permanently removes the generated file. This cannot be undone.
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
							if (!epub) {
								return;
							}
							mutation.mutate(epub.id, {
								onSuccess: () => onOpenChange(false),
							});
						}}
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
