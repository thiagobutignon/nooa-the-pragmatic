/**
 * Guardrail Contracts Tests (TDD - RED phase)
 * Test the core interfaces and types for the guardrail system.
 */
import { describe, expect, it } from "bun:test";
import {
	Confidence,
	type Finding,
	type GuardrailReport,
	Severity,
} from "./contracts";

describe("Guardrail Contracts", () => {
	describe("Severity", () => {
		it("should have correct severity levels", () => {
			expect(Severity.CRITICAL).toBe("critical");
			expect(Severity.HIGH).toBe("high");
			expect(Severity.MEDIUM).toBe("medium");
			expect(Severity.LOW).toBe("low");
			expect(Severity.INFO).toBe("info");
		});

		it("should have 5 severity levels", () => {
			const levels = Object.values(Severity);
			expect(levels).toHaveLength(5);
		});
	});

	describe("Confidence", () => {
		it("should have correct confidence levels", () => {
			expect(Confidence.HIGH).toBe("high");
			expect(Confidence.MEDIUM).toBe("medium");
			expect(Confidence.LOW).toBe("low");
		});

		it("should have 3 confidence levels", () => {
			const levels = Object.values(Confidence);
			expect(levels).toHaveLength(3);
		});
	});

	describe("Finding interface", () => {
		it("should accept a valid finding", () => {
			const finding: Finding = {
				rule: "no-hardcoded-secrets",
				message: "Hardcoded API key detected",
				file: "src/config.ts",
				line: 42,
				severity: "critical",
				category: "security",
				confidence: "high",
			};

			expect(finding.rule).toBe("no-hardcoded-secrets");
			expect(finding.severity).toBe("critical");
		});

		it("should accept optional trace field", () => {
			const finding: Finding = {
				rule: "no-todos",
				message: "TODO comment found",
				file: "src/utils.ts",
				line: 10,
				severity: "low",
				category: "quality",
				confidence: "high",
				trace: {
					provider: "guardrail",
					timestamp: "2026-02-02T12:00:00Z",
					ruleVersion: "1.0.0",
				},
			};

			expect(finding.trace?.provider).toBe("guardrail");
		});
	});

	describe("GuardrailReport interface", () => {
		it("should accept a valid report", () => {
			const report: GuardrailReport = {
				status: "pass",
				findings: [],
				summary: {
					filesScanned: 10,
					findingsTotal: 0,
					findingsBySeverity: {
						critical: 0,
						high: 0,
						medium: 0,
						low: 0,
						info: 0,
					},
					deterministic: true,
					executionMs: 123,
				},
				meta: {
					command: "check",
					traceId: "abc-123",
				},
			};

			expect(report.status).toBe("pass");
			expect(report.summary.deterministic).toBe(true);
		});

		it("should have correct status values", () => {
			const statuses: GuardrailReport["status"][] = ["pass", "warning", "fail"];
			expect(statuses).toContain("pass");
			expect(statuses).toContain("warning");
			expect(statuses).toContain("fail");
		});
	});
});
