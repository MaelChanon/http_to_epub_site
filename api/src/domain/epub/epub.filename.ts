const MAX_LENGTH = 80;

export function sanitizeFilename(raw: string): string {
	const withoutExtension = raw.replace(/\.[a-zA-Z0-9]{1,8}$/, "");
	const ascii = withoutExtension
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "");

	const slug = ascii
		.replace(/[^a-zA-Z0-9 _-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "")
		.slice(0, MAX_LENGTH);

	return slug.length > 0 ? slug : "epub";
}
