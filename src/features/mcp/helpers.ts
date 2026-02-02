export function dropSubcommandPositionals(
	positionals: string[],
	subcommand: string,
): string[] {
	if (positionals[0] === subcommand) {
		return positionals.slice(1);
	}
	return positionals;
}

export function deriveServerName(source: string): string {
	const candidate = source
		.split("/")
		.filter(Boolean)
		.pop()!
		.replace(/@/g, "")
		.replace(/[^a-z0-9-]/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return candidate || "mcp-server";
}

export function parseEnvEntries(entries: string[] | undefined) {
	const env: Record<string, string> = {};
	if (!entries) return env;
	for (const entry of entries) {
		if (!entry) continue;
		const [key, ...rest] = entry.split("=");
		if (!key) continue;
		env[key] = rest.join("=");
	}
	return env;
}
