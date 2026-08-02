import { getCurrentUser } from "@/lib/api";

export const authKeys = {
	all: ["auth"] as const,
	currentUser: () => [...authKeys.all, "me"] as const,
};

export { getCurrentUser };
