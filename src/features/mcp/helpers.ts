import { dirname, isAbsolute, join, resolve } from "node:path";

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
		.pop()
		?.replace(/@/g, "")
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

export function parseEnvContent(content: string) {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
	return parseEnvEntries(lines);
}

export async function loadEnvFile(path: string) {
	try {
		const data = await Bun.file(path).text();
		return parseEnvContent(data);
	} catch {
		return {};
	}
}

export async function fileExists(path: string) {
	try {
		await Bun.file(path).stat();
		return true;
	} catch {
		return false;
	}
}

export function expandHomePath(target: string) {
	return target.replace(/^~(?=$|[\\/])/, process.env.HOME ?? "");
}

export async function findProjectRoot(startDir: string) {
	let current = resolve(startDir);
	while (true) {
		if (
			(await fileExists(join(current, ".git"))) ||
			(await fileExists(join(current, ".nooa")))
		) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

export function resolveEnvPath(envPath: string, rootDir: string) {
	const expanded = expandHomePath(envPath);
	if (isAbsolute(expanded)) {
		return resolve(expanded);
	}
	return resolve(rootDir, expanded);
}
