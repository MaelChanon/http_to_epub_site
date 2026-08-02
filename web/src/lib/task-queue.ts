import { useSyncExternalStore } from "react";

export type TaskStatus = "pending" | "success" | "error";

export interface Task {
	id: string;
	label: string;
	status: TaskStatus;
	error?: string;
	dismissing?: boolean;
}

const SUCCESS_HOLD_MS = 1400;
const EXIT_ANIM_MS = 300;

let tasks: Task[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

function clearTimers(id: string) {
	for (const timer of timers.get(id) ?? []) {
		clearTimeout(timer);
	}
	timers.delete(id);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return tasks;
}

function addTask(label: string): string {
	const id = crypto.randomUUID();
	tasks = [...tasks, { id, label, status: "pending" }];
	emit();
	return id;
}

function settleTask(
	id: string,
	result: { status: "success" } | { status: "error"; error: string },
) {
	tasks = tasks.map((task) => (task.id === id ? { ...task, ...result } : task));
	emit();

	if (result.status === "success") {
		const dismissTimer = setTimeout(() => {
			tasks = tasks.map((task) =>
				task.id === id ? { ...task, dismissing: true } : task,
			);
			emit();

			const removeTimer = setTimeout(() => {
				removeTask(id);
			}, EXIT_ANIM_MS);
			timers.set(id, [...(timers.get(id) ?? []), removeTimer]);
		}, SUCCESS_HOLD_MS);
		timers.set(id, [dismissTimer]);
	}
}

function removeTask(id: string) {
	clearTimers(id);
	tasks = tasks.filter((task) => task.id !== id);
	emit();
}

export const taskQueueStore = {
	subscribe,
	getSnapshot,
	addTask,
	settleTask,
	removeTask,
};

export function runTrackedTask<T>(
	label: string,
	promise: Promise<T>,
): Promise<T> {
	const id = taskQueueStore.addTask(label);
	return promise.then(
		(value) => {
			taskQueueStore.settleTask(id, { status: "success" });
			return value;
		},
		(error: unknown) => {
			const message =
				error instanceof Error ? error.message : "Something went wrong";
			taskQueueStore.settleTask(id, { status: "error", error: message });
			throw error;
		},
	);
}

export function useTaskQueue(): readonly Task[] {
	return useSyncExternalStore(
		taskQueueStore.subscribe,
		taskQueueStore.getSnapshot,
	);
}
