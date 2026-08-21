import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAdminUsers } from "@/components/domain/admin/admin.queries";
import {
	GRID_COLS,
	permissionLabels,
} from "@/components/domain/admin/admin.util";
import { DeleteUserDialog } from "@/components/domain/admin/delete-user-dialog";
import { InviteUserDialog } from "@/components/domain/admin/invite-user-dialog";
import { ResetLinkDialog } from "@/components/domain/admin/reset-link-dialog";
import { UserRow } from "@/components/domain/admin/user-row";
import { Header } from "@/components/header";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/api";
import { Permission } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/users")({
	beforeLoad: ({ context }) => {
		if (!context.user.isAdmin) {
			throw redirect({ to: "/" });
		}
	},
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const { data: users, isPending } = useAdminUsers();
	const [inviteOpen, setInviteOpen] = useState(false);
	const [resetTarget, setResetTarget] = useState<User>();
	const [deleteTarget, setDeleteTarget] = useState<User>();

	return (
		<div className="min-h-screen">
			<Header />

			<main className="mx-auto max-w-[880px] px-4 py-10 sm:px-8">
				<div className="flex flex-col items-start gap-4 border-b border-(--line) pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="font-mono text-[10.5px] tracking-[0.08em] text-(--brand) uppercase">
							[admin]
						</div>
						<h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-(--ink)">
							Team access
						</h1>
						<p className="mt-1 text-[13.5px] text-(--ink-muted)">
							Grant or revoke manga permissions for each account.
						</p>
					</div>
					<Button
						type="button"
						onClick={() => setInviteOpen(true)}
						className="h-9 gap-1.5 rounded-sm bg-(--brand) px-3.5 text-[13px] text-(--brand-contrast) hover:bg-(--brand)/90"
					>
						<IconPlus className="size-3.5" />
						Invite user
					</Button>
				</div>

				{isPending && (
					<p className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
						loading users…
					</p>
				)}

				{!isPending && users && users.length === 0 && (
					<p className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
						no users yet — invite someone
					</p>
				)}

				{!isPending && users && users.length > 0 && (
					<div className="mt-6">
						<div
							className={`hidden ${GRID_COLS} items-center gap-2 border-b border-(--line) pb-2 font-mono text-[10px] tracking-[0.08em] text-(--ink-muted) uppercase md:grid`}
						>
							<span>[users]</span>
							{Permission.literals.map((perm) => (
								<span key={perm} className="text-center">
									{permissionLabels[perm]}
								</span>
							))}
							<span />
							<span />
						</div>

						{users.map((user) => (
							<UserRow
								key={user.id}
								user={user}
								onRequestReset={() => setResetTarget(user)}
								onRequestDelete={() => setDeleteTarget(user)}
							/>
						))}
					</div>
				)}
			</main>

			<InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

			<ResetLinkDialog
				user={resetTarget}
				onOpenChange={(open) => !open && setResetTarget(undefined)}
			/>

			<DeleteUserDialog
				user={deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(undefined)}
			/>
		</div>
	);
}
