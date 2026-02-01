import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PolicyViolation {
	rule: string;
	file: string;
	line: number;
	content: string;
	message: string;
}

export interface PolicyResult {
	ok: boolean;
	violations: PolicyViolation[];
}

export class PolicyEngine {
	private forbiddenMarkers = [
		{
			pattern: /TODO[:\s]/i,
			rule: "no-todo",
			message: "Zero-Preguiça: TODOs are not allowed in production code.",
		},
		{
			pattern: /MOCK[:\s]/i,
			rule: "no-mock",
			message: "Zero-Preguiça: MOCKs are not allowed in production code.",
		},
		{
			pattern: /FIXME[:\s]/i,
			rule: "no-fixme",
			message: "Zero-Preguiça: FIXMEs are not allowed in production code.",
		},
		{
			pattern: /\/\/\s*implement|placeholder/i, // nooa-ignore
			rule: "no-placeholder", // nooa-ignore
			message: "Zero-Preguiça: Implementation placeholders are not allowed.", // nooa-ignore
		},
	];

	private ignoredPatterns: string[] = [];

	constructor(cwd: string = process.cwd()) {
		const ignorePath = join(cwd, ".nooa-ignore");
		if (existsSync(ignorePath)) {
			this.ignoredPatterns = readFileSync(ignorePath, "utf-8")
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"));
		}
	}

	private isIgnored(path: string): boolean {
		return this.ignoredPatterns.some((pattern) => path.includes(pattern));
	}

	async checkFile(path: string): Promise<PolicyViolation[]> {
		if (
			path.endsWith(".md") ||
			path.endsWith(".tpl") ||
			path.includes(".test.") ||
			path.includes(".spec.") ||
			path.includes("/mock") ||
			path.endsWith(".mock.ts") ||
			this.isIgnored(path)
		)
			return [];

		const violations: PolicyViolation[] = [];
		try {
			const content = await readFile(path, "utf-8");
			const lines = content.split("\n");

			for (let i = 0; i < lines.length; i++) {
				const lineContent = lines[i];
				if (lineContent === undefined) continue;
				if (lineContent.includes("nooa-ignore")) continue;

				for (const marker of this.forbiddenMarkers) {
					if (marker.pattern.test(lineContent)) {
						violations.push({
							rule: marker.rule,
							file: path,
							line: i + 1,
							content: lineContent.trim(),
							message: marker.message,
						});
					}
				}
			}
		} catch {
			// Skip binary or unreadable files
		}
		return violations;
	}

	async checkFiles(paths: string[]): Promise<PolicyResult> {
		const allViolations: PolicyViolation[] = [];
		for (const path of paths) {
			const violations = await this.checkFile(path);
			allViolations.push(...violations);
		}

		return {
			ok: allViolations.length === 0,
			violations: allViolations,
		};
	}
}
