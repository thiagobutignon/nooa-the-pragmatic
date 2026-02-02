import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";

export async function loadIgnore(
	cwd: string = process.cwd(),
): Promise<string[]> {
	const path = join(cwd, ".nooa-ignore");
	if (!existsSync(path)) return [];
	const content = await readFile(path, "utf-8");
	return content
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"));
}

export async function saveIgnore(
	patterns: string[],
	cwd: string = process.cwd(),
) {
	const path = join(cwd, ".nooa-ignore");
	const header =
		"# NOOA Policy Ignore\n# Add patterns to ignore files or directories from Zero-Preguiça audits.\n\n";
	await writeFile(path, `${header + patterns.join("\n")}\n`);
}

export async function addPattern(pattern: string, cwd: string = process.cwd()) {
	const patterns = await loadIgnore(cwd);
	if (!patterns.includes(pattern)) {
		patterns.push(pattern);
		await saveIgnore(patterns, cwd);
		return true;
	}
	return false;
}

export async function removePattern(
	pattern: string,
	cwd: string = process.cwd(),
) {
	const patterns = await loadIgnore(cwd);
	const initialLength = patterns.length;
	const filtered = patterns.filter((p) => p !== pattern);
	if (filtered.length < initialLength) {
		await saveIgnore(filtered, cwd);
		return true;
	}
	return false;
}

function toIgnorePath(value: string, cwd: string) {
	const absolute = resolve(cwd, value || ".");
	let relativePath = relative(cwd, absolute);
	if (relativePath === "") {
		relativePath = ".";
	}
	return relativePath.split(sep).join("/");
}

export async function checkPathIgnored(
	path: string,
	cwd: string = process.cwd(),
) {
	const patterns = await loadIgnore(cwd);
	if (patterns.length === 0) {
		return { ignored: false as const };
	}

	const normalizedPath = toIgnorePath(path, cwd);

	for (const pattern of patterns) {
		const matches = picomatch(pattern, { dot: true })(normalizedPath);
		if (matches) {
			return { ignored: true as const, pattern };
		}
	}

	return { ignored: false as const };
}

export function matchesPattern(
	pattern: string,
	value: string,
	cwd: string = process.cwd(),
) {
	const normalized = toIgnorePath(value, cwd);
	if (!pattern.trim()) return false;
	return picomatch(pattern, { dot: true })(normalized);
}
