import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export type SearchResult = {
	path: string;
	line: number;
	column: number;
	snippet: string;
	matchCount?: number;
};

export type SearchOptions = {
	query: string;
	root: string;
	regex?: boolean;
	maxResults?: number;
	include?: string[];
	exclude?: string[];
	filesOnly?: boolean;
	ignoreCase?: boolean;
	caseSensitive?: boolean;
	context?: number;
	count?: boolean;
	hidden?: boolean;
	noIgnore?: boolean;
};

let cachedRg: boolean | null = null;

function envForcesEngine(): "rg" | "native" | null {
	const value = process.env.NOOA_SEARCH_ENGINE?.toLowerCase();
	if (value === "rg") return "rg";
	if (value === "native") return "native";
	return null;
}

export async function hasRipgrep(): Promise<boolean> {
	const forced = envForcesEngine();
	if (forced === "native") return false;
	if (forced === "rg") return true;
	if (cachedRg !== null) return cachedRg;

	try {
		const result = Bun.spawnSync({
			cmd: ["rg", "--version"],
			stdout: "ignore",
			stderr: "ignore",
		});
		cachedRg = result.exitCode === 0;
		return cachedRg;
	} catch {
		cachedRg = false;
		return false;
	}
}

function globToRegExp(glob: string): RegExp {
	const escaped = glob
		.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&")
		.replace(/\\\*\\\*/g, ".*")
		.replace(/\\\*/g, "[^/]*")
		.replace(/\\\?/g, ".");
	return new RegExp(`^${escaped}$`);
}

function matchesAny(patterns: string[] | undefined, value: string) {
	if (!patterns || patterns.length === 0) return false;
	return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

function shouldInclude(
	relPath: string,
	include?: string[],
	exclude?: string[],
) {
	if (include && include.length > 0) {
		if (
			!matchesAny(include, relPath) &&
			!matchesAny(include, relPath.split("/").pop() ?? "")
		) {
			return false;
		}
	}
	if (exclude && exclude.length > 0) {
		if (
			matchesAny(exclude, relPath) ||
			matchesAny(exclude, relPath.split("/").pop() ?? "")
		) {
			return false;
		}
	}
	return true;
}

async function listFiles(root: string, includeHidden: boolean) {
	const results: string[] = [];
	const skipDirs = new Set(["node_modules", ".git", ".worktrees"]);
	const stack = [root];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;
		let entries: Dirent[];
		try {
			entries = (await readdir(current, { withFileTypes: true })) as Dirent[];
		} catch {
			continue;
		}

		for (const entry of entries) {
			if (!includeHidden && entry.name.startsWith(".")) continue;
			const fullPath = join(current, entry.name);
			if (entry.isDirectory()) {
				if (skipDirs.has(entry.name)) continue;
				stack.push(fullPath);
				continue;
			}
			if (entry.isFile()) results.push(fullPath);
		}
	}

	return results;
}

async function runRgSearch(options: SearchOptions): Promise<SearchResult[]> {
	const args = ["--json", "--line-number", "--column"];
	const ignoreCase = options.ignoreCase ?? !options.caseSensitive;
	if (ignoreCase) args.push("-i");
	if (!options.regex) args.push("--fixed-strings");
	if (options.hidden) args.push("--hidden");
	if (options.context && options.context > 0) {
		args.push("-C", String(options.context));
	}
	if (options.noIgnore) {
		args.push("--no-ignore");
	}

	if (options.include) {
		for (const pattern of options.include) args.push("--glob", pattern);
	}
	if (options.exclude) {
		for (const pattern of options.exclude) args.push("--glob", `!${pattern}`);
	}

	args.push(options.query, options.root);

	const processResult = Bun.spawn({
		cmd: ["rg", ...args],
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = await new Response(processResult.stdout).text();
	const results: SearchResult[] = [];
	const contextMap = new Map<string, string[]>();

	for (const line of stdout.split("\n")) {
		if (!line.trim()) continue;
		let parsed: {
			type?: string;
			data?: {
				path?: { text?: string };
				lines?: { text?: string };
				line_number?: number;
				submatches?: { start: number; end: number }[];
			};
		};
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (parsed.type === "context") {
			const path = parsed.data?.path?.text ?? "";
			const lines = contextMap.get(path) ?? [];
			lines.push(parsed.data?.lines?.text ?? "");
			contextMap.set(path, lines);
			continue;
		}
		if (parsed.type !== "match") continue;
		const path = parsed.data?.path?.text ?? "";
		const matchLine = parsed.data?.lines?.text ?? "";
		const lineNumber = parsed.data?.line_number ?? 0;
		const sub = parsed.data?.submatches?.[0];
		const column = sub ? sub.start + 1 : 1;
		let snippet = matchLine.replace(/\n$/, "");
		if (options.context && options.context > 0) {
			const ctx = contextMap.get(path);
			if (ctx && ctx.length > 0) {
				snippet = [...ctx, snippet].join("");
			}
		}

		results.push({ path, line: lineNumber, column, snippet });
		if (options.maxResults && results.length >= options.maxResults) break;
	}

	return results;
}

async function runNativeSearch(
	options: SearchOptions,
): Promise<SearchResult[]> {
	const results: SearchResult[] = [];
	const maxResults = options.maxResults ?? 100;
	const ignoreCase = options.ignoreCase ?? !options.caseSensitive;
	const flags = ignoreCase ? "i" : "";
	const regex = options.regex
		? new RegExp(options.query, flags)
		: new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

	const files = await listFiles(options.root, Boolean(options.hidden));
	const perFileCount = new Map<string, number>();
	for (const filePath of files) {
		const relPath = relative(options.root, filePath).replace(/\\/g, "/");
		if (!shouldInclude(relPath, options.include, options.exclude)) continue;

		let fileStat: Awaited<ReturnType<typeof stat>>;
		try {
			fileStat = await stat(filePath);
		} catch {
			continue;
		}
		if (fileStat.size > 10 * 1024 * 1024) continue;

		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			continue;
		}
		if (content.includes("\u0000")) continue;

		const lines = content.split(/\r?\n/);
		for (let i = 0; i < lines.length; i += 1) {
			const lineText = lines[i] ?? "";
			const match = regex.exec(lineText);
			if (!match) continue;

			const column = match.index + 1;
			const lineNumber = i + 1;
			const context = options.context ?? 0;
			let snippet = lineText;
			if (context > 0) {
				const start = Math.max(0, i - context);
				const end = Math.min(lines.length, i + context + 1);
				snippet = lines.slice(start, end).join("\n");
			}

			if (options.count) {
				perFileCount.set(filePath, (perFileCount.get(filePath) ?? 0) + 1);
				continue;
			}

			results.push({
				path: filePath,
				line: lineNumber,
				column,
				snippet,
			});

			if (results.length >= maxResults) break;
		}

		if (results.length >= maxResults) break;
	}

	if (options.count) {
		return Array.from(perFileCount.entries()).map(([path, count]) => ({
			path,
			line: 0,
			column: 0,
			snippet: "",
			matchCount: count,
		}));
	}

	return results;
}

export async function runSearch(
	options: SearchOptions,
): Promise<SearchResult[]> {
	const maxResults = options.maxResults ?? 100;
	const effectiveOptions = { ...options, maxResults };
	const useRg = await hasRipgrep();
	const engine = envForcesEngine();
	if (engine === "native") return runNativeSearch(effectiveOptions);
	if (engine === "rg") return runRgSearch(effectiveOptions);
	return useRg
		? runRgSearch(effectiveOptions)
		: runNativeSearch(effectiveOptions);
}
