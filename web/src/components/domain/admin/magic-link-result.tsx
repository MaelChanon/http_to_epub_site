import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";

function formatDuration(seconds: number) {
	if (seconds % 3600 === 0 && seconds >= 3600) {
		const hours = seconds / 3600;
		return hours === 1 ? "1 hour" : `${hours} hours`;
	}
	const minutes = Math.round(seconds / 60);
	return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function MagicLinkResult({
	path,
	token,
	expiresInSeconds,
}: {
	path: string;
	token: string;
	expiresInSeconds: number;
}) {
	const [copied, setCopied] = useState(false);
	const url = `${window.location.origin}${path}/${token}`;

	async function copy() {
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="flex flex-col gap-2.5 rounded-sm border border-(--line) bg-(--bg-elev-2) px-3.5 py-3">
			<span className="font-mono text-[10.5px] tracking-[0.05em] text-(--ink-muted) uppercase">
				Share this link
			</span>
			<code className="block truncate font-mono text-[12px] text-(--ink-soft)">
				{url}
			</code>
			<div className="flex items-center justify-between gap-3">
				<span className="text-[12px] text-(--ink-muted)">
					Expires in {formatDuration(expiresInSeconds)}. Single use.
				</span>
				<Button
					type="button"
					variant="outline"
					onClick={copy}
					className="h-8 shrink-0 gap-1.5 rounded-sm px-3 text-[12.5px]"
				>
					{copied && <IconCheck className="size-3.5" />}
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
		</div>
	);
}
