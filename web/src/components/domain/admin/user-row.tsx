import { useUpdateUserPermissions } from "@/components/domain/admin/admin.queries";
import {
	GRID_COLS,
	initialHue,
	permissionLabels,
} from "@/components/domain/admin/admin.util";
import { IconCheck, IconClose, IconRefresh } from "@/components/icons";
import type { Permission, User } from "@/lib/api";
import { Permission as PermissionSchema } from "@/lib/api";

export function UserRow({
	user,
	onRequestReset,
	onRequestDelete,
}: {
	user: User;
	onRequestReset: () => void;
	onRequestDelete: () => void;
}) {
	const mutation = useUpdateUserPermissions();
	const hue = initialHue(user.email);

	function toggle(perm: Permission) {
		const next = user.permissions.includes(perm)
			? user.permissions.filter((p) => p !== perm)
			: [...user.permissions, perm];
		mutation.mutate({ user, permissions: next });
	}

	return (
		<div
			className={`grid ${GRID_COLS} items-center gap-2 border-b border-(--line) py-3`}
		>
			<div className="flex min-w-0 items-center gap-3">
				<div
					className="grid size-9 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold text-white"
					style={{ background: `oklch(0.6 0.13 ${hue})` }}
				>
					{user.pseudo.slice(0, 1).toUpperCase()}
				</div>
				<div className="min-w-0">
					<div className="truncate text-[13.5px] font-medium text-(--ink)">
						{user.pseudo}
					</div>
					<div className="truncate font-mono text-[11px] text-(--ink-muted)">
						{user.email}
					</div>
				</div>
			</div>

			{PermissionSchema.literals.map((perm) => {
				const active = user.permissions.includes(perm);
				const pending =
					mutation.isPending && mutation.variables?.user.id === user.id;
				return (
					<div key={perm} className="flex justify-center">
						<button
							type="button"
							aria-pressed={active}
							aria-label={`${active ? "Revoke" : "Grant"} ${permissionLabels[perm]} for ${user.pseudo}`}
							disabled={pending}
							onClick={() => toggle(perm)}
							className={`grid size-7 place-items-center rounded-md border transition-colors disabled:opacity-50 ${
								active
									? "border-(--brand) bg-(--brand-soft) text-(--brand)"
									: "border-(--line) text-transparent hover:border-(--line-strong) hover:text-(--ink-muted)"
							}`}
						>
							<IconCheck className="size-3.5" />
						</button>
					</div>
				);
			})}

			<div className="flex justify-center">
				<button
					type="button"
					aria-label={`Reset password for ${user.pseudo}`}
					onClick={onRequestReset}
					className="grid size-7 place-items-center rounded-md text-(--ink-muted) hover:text-(--brand)"
				>
					<IconRefresh className="size-3.5" />
				</button>
			</div>

			<div className="flex justify-center">
				<button
					type="button"
					aria-label={`Delete ${user.pseudo}`}
					onClick={onRequestDelete}
					className="grid size-7 place-items-center rounded-md text-(--ink-muted) hover:text-destructive"
				>
					<IconClose className="size-3.5" />
				</button>
			</div>
		</div>
	);
}
