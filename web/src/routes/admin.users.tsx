import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { authKeys, getCurrentUser } from "@/auth/auth.queries";
import { useAdminUsers } from "@/components/domain/admin/admin.queries";
import {
	GRID_COLS,
	permissionLabels,
} from "@/components/domain/admin/admin.util";
import { CreateUserDialog } from "@/components/domain/admin/create-user-dialog";
import { DeleteUserDialog } from "@/components/domain/admin/delete-user-dialog";
import { UserRow } from "@/components/domain/admin/user-row";
import { Header } from "@/components/header";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/api";
import { Permission } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			queryKey: authKeys.currentUser(),
			queryFn: getCurrentUser,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}
		if (!user.isAdmin) {
			throw redirect({ to: "/" });
		}
	},
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const { data: users, isPending } = useAdminUsers();
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<User>();

	return (
		<div className="min-h-screen">
			<Header />

			<main className="mx-auto max-w-[880px] px-8 py-10">
				<div className="flex items-end justify-between gap-4 border-b border-(--line) pb-5">
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
						onClick={() => setCreateOpen(true)}
						className="h-9 gap-1.5 rounded-sm bg-(--brand) px-3.5 text-[13px] text-(--brand-contrast) hover:bg-(--brand)/90"
					>
						<IconPlus className="size-3.5" />
						Create user
					</Button>
				</div>

				{isPending && (
					<p className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
						loading users…
					</p>
				)}

				{!isPending && users && users.length === 0 && (
					<p className="py-16 text-center font-mono text-[12px] text-(--ink-muted)">
						no users yet — create the first one
					</p>
				)}

				{!isPending && users && users.length > 0 && (
					<div className="mt-6">
						<div
							className={`grid ${GRID_COLS} items-center gap-2 border-b border-(--line) pb-2 font-mono text-[10px] tracking-[0.08em] text-(--ink-muted) uppercase`}
						>
							<span>[users]</span>
							{Permission.literals.map((perm) => (
								<span key={perm} className="text-center">
									{permissionLabels[perm]}
								</span>
							))}
							<span />
						</div>

						{users.map((user) => (
							<UserRow
								key={user.id}
								user={user}
								onRequestDelete={() => setDeleteTarget(user)}
							/>
						))}
					</div>
				)}
			</main>

			<CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

			<DeleteUserDialog
				user={deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(undefined)}
			/>
		</div>
	);
}
