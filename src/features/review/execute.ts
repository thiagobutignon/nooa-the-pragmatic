import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { EventBus } from "../../core/event-bus";
import { createTraceId, logger } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { AiEngine } from "../ai/engine";
import {
	MockProvider,
	OllamaProvider,
	OpenAiProvider,
} from "../ai/providers/mod";
import { PromptEngine } from "../prompt/engine";
import { getGoal } from "../goal/execute";

export interface ReviewFinding {
	severity: "low" | "medium" | "high";
	file: string;
	line: number | null;
	category: string;
	message: string;
	suggestion: string;
}

export interface ReviewResult {
	schemaVersion: string;
	ok: boolean;
	summary: string;
	findings: ReviewFinding[];
	maxSeverity: "none" | "low" | "medium" | "high";
	stats: {
		files: number;
		findings: number;
	};
	truncated?: boolean;
}

export interface ReviewOptions {
	path?: string;
	staged?: boolean;
	diff?: string;
	json?: boolean;
	prompt?: string;
	failOn?: string;
	traceId?: string;
}

export async function executeReview(
	options: ReviewOptions,
	bus?: EventBus,
): Promise<{ content: string; result?: ReviewResult; traceId: string }> {
	const traceId = options.traceId || createTraceId();
	const startTime = Date.now();

	// 1. Get Input
	let input = "";
	let fileCount = 0;
	let truncated = false;
	const MAX_REVIEW_BYTES = 50 * 1024; // 50KB limit for "instant" review

	if (options.diff) {
		input = options.diff;
		fileCount = (input.match(/^diff --git/gm) || []).length;
	} else if (options.path) {
		input = await readFile(options.path, "utf-8");
		fileCount = 1;
	} else if (options.staged) {
		const diff = await execa("git", ["diff", "--cached"], { reject: false });
		input = diff.stdout;
		// Basic file count from diff
		fileCount = (input.match(/^diff --git/gm) || []).length;
	} else {
		throw new Error("No input source provided (path, staged, or diff).");
	}

	if (input.length > MAX_REVIEW_BYTES) {
		input =
			input.substring(0, MAX_REVIEW_BYTES) +
			"\n... (content truncated for review) ...";
		truncated = true;
	}

	if (!input.trim()) {
		return { content: "No changes found to review.", traceId };
	}

	// 2. Load Prompt & Test Grounding
	const templatesDir = join(process.cwd(), "src/features/prompt/templates");
	const promptEngine = new PromptEngine(templatesDir);
	const promptName = options.prompt || "review";
	const promptTemplate = await promptEngine.loadPrompt(promptName);

	let testGrounding = "No candidate tests discovered by naming heuristic.";
	if (options.path) {
		const { discoverTests } = await import("./discovery");
		const candidates = await discoverTests(options.path, process.cwd());
		if (candidates.length > 0) {
			testGrounding = `Discovered candidate test files: ${candidates.join(", ")}. Note: Coverage not verified.`;
		}
	}

	const systemPrompt = await promptEngine.renderPrompt(promptTemplate, {
		repo_root: process.cwd(),
		input_path: options.path || "staged_changes",
		input_type: options.path ? "file" : "diff",
		input_scope: options.path ? "single_file" : "diff",
		test_grounding: testGrounding,
		project_conventions:
			"- Preferred: Dynamic imports for filesystem/process heavy modules to keep startup fast.\n- Preferred: Telemetry for all user-facing command results.",
		input: input,
		goal: await getGoal() || "No specific goal set.",
	});

	// 3. Call AI
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new MockProvider());

	const response = await engine.complete(
		{
			messages: [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: options.json
						? "Please provide the review in the JSON format specified in your instructions. ENSURE all 'file' paths are relative to the repository root."
						: "Please provide a code review for the provided input.",
				},
			],
			traceId,
		},
		{
			provider: process.env.NOOA_AI_PROVIDER || "ollama",
			fallbackProvider: "openai",
		},
	);

	let result: ReviewResult | undefined;
	if (options.json) {
		try {
			// Find JSON block in response if AI wrapped it in markdown
			const jsonMatch = response.content.match(/\{[\s\S]*\}/);
			const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response.content);

			// Strict Validation & Normalization
			if (typeof parsed.ok === "boolean" && Array.isArray(parsed.findings)) {
				result = parsed as ReviewResult;
				const validCategories = [
					"bug",
					"style",
					"test",
					"arch",
					"security",
					"observability",
				];

				result.findings = result.findings.map((f) => {
					// Normalize category
					let category = f.category?.toLowerCase() || "style";
					if (category === "maintainability") category = "arch";
					if (!validCategories.includes(category)) category = "arch";

					// Ensure relative paths and fallback
					const isInvalidFile =
						!f.file || f.file === "unknown" || f.file === "string";
					return {
						...f,
						category,
						file:
							!isInvalidFile && !f.file.startsWith("/")
								? f.file
								: options.path || "staged_changes",
						line: typeof f.line === "number" ? f.line : null,
					};
				});
			} else {
				logger.error(
					"review.json_invalid",
					new Error("AI returned JSON missing required fields (ok, findings)"),
				);
			}
		} catch (e) {
			logger.error("review.json_parse_failed", e as Error);
		}
	}

	const _levels: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
	let maxSeverity: ReviewResult["maxSeverity"] = "none";
	if (result?.findings && result.findings.length > 0) {
		const severities = result.findings.map((f) => f.severity);
		if (severities.includes("high")) maxSeverity = "high";
		else if (severities.includes("medium")) maxSeverity = "medium";
		else if (severities.includes("low")) maxSeverity = "low";
	}

	if (result) {
		result.maxSeverity = maxSeverity;
		result.truncated = truncated;
	}

	const duration = Date.now() - startTime;
	telemetry.track(
		{
			event: "review.success",
			level: "info",
			success: true,
			duration_ms: duration,
			trace_id: traceId,
			metadata: {
				source: options.path ? "file" : "staged",
				findings_count: result?.findings.length || 0,
				file_count: fileCount,
				max_severity: maxSeverity,
				truncated,
			},
		},
		bus,
	);

	return { content: response.content, result, traceId };
}
