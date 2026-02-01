import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { dirname, join } from "node:path";

export interface ContextResult {
	target: string;
	content: string;
	related: string[];
	tests: string[];
	recentCommits: string[];
	symbols: string[];
	isSymbol?: boolean;
}

async function findFileBySymbol(symbol: string): Promise<string | null> {
	try {
		// Use ripgrep to find definition of class or function
		const { stdout } = await execa("rg", [
			"-l",
			`\\b(class|function|interface|const|type)\\s+${symbol}\\b`,
			".",
			"--glob",
			"*.ts",
			"--glob",
			"!node_modules/**",
		]);
		const files = stdout.split("\n").filter(Boolean);
		return files[0] || null;
	} catch {
		return null;
	}
}

export async function buildContext(target: string): Promise<ContextResult> {
	let filePath = target;
	let isSymbol = false;

	// Check if target is a file
	try {
		await readFile(target, "utf-8");
	} catch {
		// Not a file, try symbol lookup
		const found = await findFileBySymbol(target);
		if (found) {
			filePath = found;
			isSymbol = true;
		} else {
			throw new Error(`File or symbol '${target}' not found.`);
		}
	}

	const content = await readFile(filePath, "utf-8");
	const dir = dirname(filePath);

	// Find related files (imports) - basic heuristic
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

	// Extract symbols in the file (top-level only)
	const symbolMatches =
		content.match(
			/^(?:export\s+)?(?:class|function|interface|type|const|enum|var|let)\s+([a-zA-Z0-9_]+)/gm,
		) || [];
	const symbols = symbolMatches.map((m) => m.trim().split(/\s+/).pop() || "");

	return {
		target: isSymbol ? `${target} (in ${filePath})` : filePath,
		content,
		related,
		tests,
		recentCommits,
		symbols,
		isSymbol,
	};
}
