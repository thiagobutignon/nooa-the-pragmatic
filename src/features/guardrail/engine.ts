/**
 * Guardrail Engine
 * Deterministic pattern matching engine using ripgrep.
 * Clean-room implementation (AGPL-safe).
 */
import { execSync, spawnSync } from "node:child_process";
import { minimatch } from "minimatch";
import type { Confidence, Finding, Severity } from "./contracts";
import type {
    Pattern,
    PatternSpec,
    RefactorProfile,
    RefactorRule,
} from "./schemas";

/**
 * GuardrailEngine - Evaluates profiles against a codebase.
 * Uses git ls-files for deterministic file set.
 * Returns findings sorted for byte-identical JSON output.
 */
export class GuardrailEngine {
    constructor(private readonly cwd: string) { }

    /**
     * Evaluate a profile against the codebase.
     * @param profile - The refactor profile to evaluate
     * @param options - Optional settings for evaluation
     * @returns Array of findings, sorted for determinism
     */
    async evaluate(
        profile: RefactorProfile,
        options: { deterministic?: boolean } = { deterministic: true },
    ): Promise<Finding[]> {
        const allFindings: Finding[] = [];

        for (const rule of profile.rules) {
            const ruleFindings = await this.evaluateRule(rule, profile.version);
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
    ): Promise<Finding[]> {
        const findings: Finding[] = [];
        const patterns = this.getPatterns(rule.match);

        for (const pattern of patterns) {
            const matches = await this.searchPattern(pattern, rule.scope);
            for (const match of matches) {
                // Check for ignore comments on the same line as the finding
                if (
                    match.content.includes("// nooa-ignore") ||
                    match.content.includes("/* nooa-ignore */")
                ) {
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

        return findings;
    }

    /**
     * Extract patterns from PatternSpec.
     */
    private getPatterns(spec: PatternSpec): Pattern[] {
        const patterns: Pattern[] = [];

        if (spec.anyOf) {
            patterns.push(...spec.anyOf);
        }
        if (spec.allOf) {
            patterns.push(...spec.allOf);
        }

        return patterns;
    }

    /**
     * Search for a pattern using ripgrep.
     * Uses git ls-files for deterministic file set.
     */
    private async searchPattern(
        pattern: Pattern,
        scope?: { include?: string[]; exclude?: string[] },
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
            // Get file list from git for determinism
            const gitFiles = this.getTrackedFiles();
            if (gitFiles.length === 0) {
                return results;
            }

            // Build ripgrep args - search directly on files
            const rgArgs = [
                "-n", // Line numbers
                "--column", // Column numbers
                "--no-heading", // No file headers
            ];

            if (pattern.type === "literal") {
                rgArgs.push("-F", pattern.value); // Fixed string
            } else {
                rgArgs.push(pattern.value); // Regex
                if (pattern.flags?.includes("i")) {
                    rgArgs.push("-i"); // Case insensitive
                }
            }

            // Add all git-tracked files as arguments
            rgArgs.push(...gitFiles);

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
            return result.split("\n").filter(Boolean);
        } catch {
            return [];
        }
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
