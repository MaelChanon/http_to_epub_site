import { Effect, Layer } from "effect";
import { appConfig } from "../../config.js";
import { MagicLinkService } from "./magicLink.service.js";
import { UserService } from "./user.service.js";

function formatDuration(seconds: number) {
	const hours = Math.round(seconds / 3600);
	return hours === 1 ? "1 hour" : `${hours} hours`;
}

const announceBootstrapInvite = Effect.gen(function* () {
	const userService = yield* UserService;
	const magicLinkService = yield* MagicLinkService;
	const config = yield* appConfig;

	const total = yield* userService.countUsers();
	if (total > 0) {
		return;
	}

	const link = yield* magicLinkService.getOrCreateBootstrapInvite();
	const origin = config.corsAllowedOrigins[0] ?? "";

	yield* Effect.logInfo(
		[
			"",
			"  No user in the database yet — open this link to create the first account:",
			"",
			`    ${origin}/invite/${link.token}`,
			"",
			`  Single use, expires in ${formatDuration(link.expiresInSeconds)}.`,
			"  Whoever uses it becomes the administrator.",
			"",
		].join("\n"),
	);
});

export const BootstrapInviteLive = Layer.effectDiscard(
	announceBootstrapInvite.pipe(
		Effect.catchAllCause((cause) =>
			Effect.logError(`failed to issue the bootstrap invite link: ${cause}`),
		),
	),
);
