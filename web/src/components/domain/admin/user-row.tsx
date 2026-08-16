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
			className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-(--line) py-3 ${GRID_COLS} md:gap-2`}
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

			<div className="col-span-2 order-3 flex flex-wrap gap-1.5 md:contents">
				{PermissionSchema.literals.map((perm) => {
					const active = user.permissions.includes(perm);
					return (
						<div key={perm} className="md:flex md:justify-center">
							<button
								type="button"
								aria-pressed={active}
								aria-label={`${active ? "Revoke" : "Grant"} ${permissionLabels[perm]} for ${user.pseudo}`}
								onClick={() => toggle(perm)}
								className={`group flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors md:grid md:size-7 md:place-items-center md:gap-0 md:px-0 ${
									active
										? "border-(--brand) bg-(--brand-soft) text-(--brand)"
										: "border-(--line) text-(--ink-soft) hover:border-(--line-strong)"
								}`}
							>
								<IconCheck
									className={`size-3.5 shrink-0 transition-colors ${
										active
											? ""
											: "text-transparent group-hover:text-(--ink-muted)"
									}`}
								/>
								<span className="md:hidden">{permissionLabels[perm]}</span>
							</button>
						</div>
					);
				})}
			</div>

			<div className="order-2 flex items-center justify-end gap-1 md:contents">
				<div className="md:flex md:justify-center">
					<button
						type="button"
						aria-label={`Reset password for ${user.pseudo}`}
						onClick={onRequestReset}
						className="grid size-8 place-items-center rounded-md text-(--ink-muted) transition-colors hover:text-(--brand) md:size-7"
					>
						<IconRefresh className="size-3.5" />
					</button>
				</div>
				<div className="md:flex md:justify-center">
					<button
						type="button"
						aria-label={`Delete ${user.pseudo}`}
						onClick={onRequestDelete}
						className="grid size-8 place-items-center rounded-md text-(--ink-muted) transition-colors hover:text-destructive md:size-7"
					>
						<IconClose className="size-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}
