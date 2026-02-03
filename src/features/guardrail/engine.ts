/**
 * Guardrail Engine
 * Deterministic pattern matching engine using ripgrep.
 * Clean-room implementation (AGPL-safe).
 */
import { execSync, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { minimatch } from "minimatch";
import type { Confidence, Finding, Severity } from "./contracts";
import type { Pattern, RefactorProfile, RefactorRule } from "./schemas";

/**
 * GuardrailEngine - Evaluates profiles against a codebase.
 * Uses git ls-files for deterministic file set.
 * Returns findings sorted for byte-identical JSON output.
 */
export class GuardrailEngine {
	constructor(private readonly cwd: string) {}

	/**
	 * Evaluate a profile against the codebase.
	 * @param profile - The refactor profile to evaluate
	 * @param options - Optional settings for evaluation
	 * @returns Array of findings, sorted for determinism
	 */
	async evaluate(
		profile: RefactorProfile,
		options: {
			deterministic?: boolean;
			files?: string[];
			exclude?: string[];
		} = { deterministic: true },
	): Promise<Finding[]> {
		const allFindings: Finding[] = [];
		const baseFiles = this.filterFiles(
			options.files ?? this.getTrackedFiles(),
			options.exclude,
		);

		for (const rule of profile.rules) {
			const ruleFindings = await this.evaluateRule(
				rule,
				profile.version,
				baseFiles,
			);
			allFindings.push(...ruleFindings);
		}

		// Sort for determinism: rule → file → line → column
		if (options.deterministic !== false) {
			allFindings.sort(
				(a, b) =>
					a.rule.localeCompare(b.rule) ||
					a.file.localeCompare(b.file) ||
					a.line - b.line ||
					(a.column ?? 0) - (b.column ?? 0),
			);
		}

		return allFindings;
	}

	/**
	 * Evaluate a single rule.
	 */
	private async evaluateRule(
		rule: RefactorRule,
		_profileVersion?: string,
		fileList?: string[],
	): Promise<Finding[]> {
		const findings: Finding[] = [];
		const anyOf = rule.match.anyOf ?? [];
		const allOf = rule.match.allOf ?? [];

		const shouldIgnore = (content: string) =>
			content.includes("// nooa-ignore") ||
			content.includes("/* nooa-ignore */");

		for (const pattern of anyOf) {
			const matches = await this.searchPattern(pattern, rule.scope, fileList);
			for (const match of matches) {
				if (shouldIgnore(match.content)) {
					continue;
				}

				findings.push({
					rule: rule.id,
					message: rule.description,
					file: match.file,
					line: match.line,
					column: match.column,
					severity: rule.severity as Severity,
					category: rule.category ?? "guardrail",
					confidence: "high" as Confidence,
					snippet: match.content,
				});
			}
		}

		if (allOf.length > 0) {
			const fileMatches = new Map<
				string,
				{
					matches: Array<{ line: number; column?: number; content: string }>;
					count: number;
				}
			>();

			for (const pattern of allOf) {
				const matches = await this.searchPattern(pattern, rule.scope, fileList);
				const seenFiles = new Set<string>();

				for (const match of matches) {
					const entry = fileMatches.get(match.file) ?? {
						matches: [],
						count: 0,
					};
					entry.matches.push({
						line: match.line,
						column: match.column,
						content: match.content,
					});
					fileMatches.set(match.file, entry);
					seenFiles.add(match.file);
				}

				for (const file of seenFiles) {
					const entry = fileMatches.get(file);
					if (entry) {
						entry.count += 1;
					}
				}
			}

			for (const [file, entry] of fileMatches.entries()) {
				if (entry.count !== allOf.length) continue;
				for (const match of entry.matches) {
					if (shouldIgnore(match.content)) {
						continue;
					}
					findings.push({
						rule: rule.id,
						message: rule.description,
						file,
						line: match.line,
						column: match.column,
						severity: rule.severity as Severity,
						category: rule.category ?? "guardrail",
						confidence: "high" as Confidence,
						snippet: match.content,
					});
				}
			}
		}

		return findings;
	}

	/**
	 * Search for a pattern using ripgrep.
	 * Uses git ls-files for deterministic file set.
	 */
	private async searchPattern(
		pattern: Pattern,
		scope?: { include?: string[]; exclude?: string[] },
		fileList?: string[],
	): Promise<
		Array<{ file: string; line: number; column?: number; content: string }>
	> {
		const results: Array<{
			file: string;
			line: number;
			column?: number;
			content: string;
		}> = [];

		try {
			const files = fileList ?? this.getTrackedFiles();
			if (files.length === 0) {
				return results;
			}

			// Build ripgrep args - search directly on files
			const rgArgs = [
				"-n", // Line numbers
				"--column", // Column numbers
				"--no-heading", // No file headers
				"--with-filename", // Always include filename
			];

			if (pattern.type === "literal") {
				rgArgs.push("-F", pattern.value); // Fixed string
			} else {
				rgArgs.push(pattern.value); // Regex
				if (pattern.flags?.includes("i")) {
					rgArgs.push("-i"); // Case insensitive
				}
			}

			// Add all files as arguments
			rgArgs.push(...files);

			// Run ripgrep
			const rgResult = spawnSync("rg", rgArgs, {
				cwd: this.cwd,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});

			if (rgResult.stdout) {
				const parsed = this.parseRgOutput(rgResult.stdout, scope);
				results.push(...parsed);
			}
		} catch {
			// Ripgrep not found or error - return empty
		}

		return results;
	}

	/**
	 * Get tracked files from git for deterministic file set.
	 */
	private getTrackedFiles(): string[] {
		try {
			const result = execSync("git ls-files", {
				cwd: this.cwd,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			const files = result.split("\n").filter(Boolean);
			if (files.length > 0) {
				return files;
			}
		} catch {
			// Fall through to filesystem scan
		}
		return this.listFilesRecursively(this.cwd);
	}

	private filterFiles(files: string[], exclude?: string[]): string[] {
		if (!exclude?.length) return files;
		return files.filter(
			(file) => !exclude.some((pattern) => minimatch(file, pattern)),
		);
	}

	private listFilesRecursively(root: string): string[] {
		const results: string[] = [];
		const stack = [root];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;
			let entries: string[] = [];
			try {
				entries = readdirSync(current);
			} catch {
				continue;
			}

			for (const entry of entries) {
				if (entry === ".git" || entry === "node_modules") continue;
				const fullPath = join(current, entry);
				let stat;
				try {
					stat = statSync(fullPath);
				} catch {
					continue;
				}
				if (stat.isDirectory()) {
					stack.push(fullPath);
				} else if (stat.isFile()) {
					results.push(relative(this.cwd, fullPath));
				}
			}
		}

		return results.sort();
	}

	/**
	 * Parse ripgrep output into structured results.
	 */
	private parseRgOutput(
		stdout: string,
		scope?: { include?: string[]; exclude?: string[] },
	): Array<{ file: string; line: number; column?: number; content: string }> {
		const results: Array<{
			file: string;
			line: number;
			column?: number;
			content: string;
		}> = [];

		for (const line of stdout.split("\n").filter(Boolean)) {
			// Format: file:line:column:content
			const match = line.match(/^([^:]+):(\d+):(\d+):(.*)$/);
			if (!match) continue;

			const file = match[1];
			const lineNum = match[2];
			const colNum = match[3];
			const content = match[4];

			if (!file || !lineNum || !colNum) continue;

			// Apply scope filtering
			if (scope?.exclude?.some((p) => minimatch(file, p))) {
				continue;
			}
			if (
				scope?.include?.length &&
				!scope.include.some((p) => minimatch(file, p))
			) {
				continue;
			}

			results.push({
				file,
				line: parseInt(lineNum, 10),
				column: parseInt(colNum, 10),
				content: (content ?? "").trim(),
			});
		}

		return results;
	}
}
