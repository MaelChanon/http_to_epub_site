import { useState } from "react";
import { useCreateInvite } from "@/components/domain/admin/admin.queries";
import { fullPermissionLabels } from "@/components/domain/admin/admin.util";
import { MagicLinkResult } from "@/components/domain/admin/magic-link-result";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Permission } from "@/lib/api";
import { ApiError, Permission as PermissionSchema } from "@/lib/api";

export function InviteUserDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const mutation = useCreateInvite();

	function togglePermission(perm: Permission) {
		setPermissions((current) =>
			current.includes(perm)
				? current.filter((p) => p !== perm)
				: [...current, perm],
		);
	}

	function close(next: boolean) {
		if (!next) {
			setPermissions([]);
			mutation.reset();
		}
		onOpenChange(next);
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite a user</DialogTitle>
					<DialogDescription>
						{mutation.data
							? "Send them this link. They pick their own name, email and password."
							: "Choose what they will be allowed to do, then share the link."}
					</DialogDescription>
				</DialogHeader>

				{mutation.data ? (
					<div className="flex flex-col gap-3.5">
						<MagicLinkResult
							path="/invite"
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
					<form
						className="flex flex-col gap-3.5"
						onSubmit={(event) => {
							event.preventDefault();
							mutation.mutate(permissions);
						}}
					>
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
							{mutation.isPending ? "Creating link..." : "Create invite link"}
						</Button>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
