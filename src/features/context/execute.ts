import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { dirname, basename, join } from "node:path";

export interface ContextResult {
	target: string;
	content: string;
	related: string[];
	tests: string[];
	recentCommits: string[];
}

export async function buildContext(filePath: string): Promise<ContextResult> {
	const content = await readFile(filePath, "utf-8");
	const dir = dirname(filePath);
	const _base = basename(filePath, ".ts");

	// Find related files (imports) - very basic heuristic for now
	const importMatches = content.match(/from ["']\.\/([^"']+)["']/g) || [];
	const related = importMatches.map((m) =>
		join(dir, m.replace(/from ["']\.\//, "").replace(/["']/, "") + ".ts"),
	);

	// Find test files
	const testPath = filePath.replace(".ts", ".test.ts");
	const tests = [testPath];

	// Recent commits
	const { stdout } = await execa("git", ["log", "--oneline", "-5", "--", filePath], {
		reject: false,
	});
	const recentCommits = stdout.split("\n").filter(Boolean);

	return { target: filePath, content, related, tests, recentCommits };
}
