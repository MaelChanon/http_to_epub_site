import { IconCheck, IconClose, IconRefresh } from "@/components/icons";
import { type Task, taskQueueStore, useTaskQueue } from "@/lib/task-queue";

export function TaskQueueTray() {
	const tasks = useTaskQueue();

	if (tasks.length === 0) {
		return null;
	}

	return (
		<div className="fixed right-4 bottom-4 z-60 flex w-[320px] flex-col gap-2">
			{tasks.map((task) => (
				<TaskQueueItem key={task.id} task={task} />
			))}
		</div>
	);
}

function TaskQueueItem({ task }: { task: Task }) {
	return (
		<div
			className={`flex items-start gap-2.5 rounded-[10px] border p-3 shadow-(--shadow-lg) ${
				task.status === "error"
					? "border-destructive/40 bg-(--bg-elev)"
					: "border-(--line) bg-(--bg-elev)"
			} ${
				task.dismissing
					? "animate-out fade-out-0 slide-out-to-right-3 duration-300"
					: "animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
			}`}
		>
			<span className="mt-0.5 grid size-5 shrink-0 place-items-center">
				{task.status === "pending" && (
					<IconRefresh className="animate-spin text-(--ink-muted)" />
				)}
				{task.status === "success" && <IconCheck className="text-(--brand)" />}
				{task.status === "error" && (
					<span className="size-2 rounded-full bg-destructive" />
				)}
			</span>

			<div className="min-w-0 flex-1">
				<p className="truncate text-[12.5px] text-(--ink)">{task.label}</p>
				{task.status === "error" && task.error && (
					<p className="mt-0.5 text-[11px] text-destructive">{task.error}</p>
				)}
			</div>

			{task.status === "error" && (
				<button
					type="button"
					aria-label="Dismiss"
					onClick={() => taskQueueStore.removeTask(task.id)}
					className="grid size-5 shrink-0 place-items-center rounded-md text-(--ink-muted) hover:text-(--ink)"
				>
					<IconClose />
				</button>
			)}
		</div>
	);
}
