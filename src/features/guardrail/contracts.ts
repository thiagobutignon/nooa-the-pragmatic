/**
 * Guardrail Contracts
 * Core types and interfaces for the guardrail system.
 * Clean-room implementation based on Auditor behavior spec.
 */

/**
 * Severity levels for findings.
 * Ordered from most to least severe.
 */
export const Severity = {
	CRITICAL: "critical",
	HIGH: "high",
	MEDIUM: "medium",
	LOW: "low",
	INFO: "info",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

/**
 * Confidence levels for findings.
 * Indicates how certain the detection is.
 */
export const Confidence = {
	HIGH: "high",
	MEDIUM: "medium",
	LOW: "low",
} as const;
export type Confidence = (typeof Confidence)[keyof typeof Confidence];

/**
 * A single finding from guardrail analysis.
 */
export interface Finding {
	/** Unique identifier for the rule that generated this finding */
	rule: string;
	/** Human-readable description of the issue */
	message: string;
	/** File path where the issue was found */
	file: string;
	/** Line number (1-indexed) */
	line: number;
	/** Column number (1-indexed, optional) */
	column?: number;
	/** Severity level */
	severity: Severity;
	/** Category of the finding (e.g., security, quality) */
	category: string;
	/** Confidence level */
	confidence: Confidence;
	/** Code snippet showing the issue */
	snippet?: string;
	/** CWE identifier if applicable */
	cweId?: string;
	/** External references */
	references?: string[];
	/** Traceability information (omitted in deterministic mode) */
	trace?: {
		/** Source of the finding */
		provider: "policy" | "guardrail";
		/** When it was detected (omitted in --deterministic) */
		timestamp: string;
		/** Version of the rule profile */
		ruleVersion?: string;
	};
}

/**
 * Complete guardrail report structure.
 */
export interface GuardrailReport {
	/** Overall status */
	status: "pass" | "warning" | "fail";
	/** All findings from the analysis */
	findings: Finding[];
	/** Summary statistics */
	summary: {
		/** Number of files scanned */
		filesScanned: number;
		/** Total number of findings */
		findingsTotal: number;
		/** Breakdown by severity */
		findingsBySeverity: Record<Severity, number>;
		/** Whether output is byte-identical reproducible */
		deterministic: true;
		/** Execution time in milliseconds */
		executionMs: number;
	};
	/** Metadata about the run */
	meta: {
		/** Command that was executed */
		command: string;
		/** Profile path if used */
		profile?: string;
		/** Trace ID (fixed in --deterministic mode or with --trace-id) */
		traceId: string;
	};
}

/**
 * Exit codes for guardrail/check commands.
 * Scoped to these commands only, does not affect other NOOA commands.
 */
export const ExitCode = {
	SUCCESS: 0,
	RUNTIME_ERROR: 1,
	VALIDATION_ERROR: 2,
	BLOCKING_FINDINGS: 3,
	WARNING_FINDINGS: 4,
} as const;
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
