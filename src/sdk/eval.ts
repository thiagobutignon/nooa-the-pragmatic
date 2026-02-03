import { randomUUID } from "node:crypto";
import { EvalEngine } from "../features/eval/engine";
import { appendHistory, loadHistory, type EvalHistoryEntry } from "../features/eval/history";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type EvalJudge = "deterministic" | "llm";

export interface EvalRunInput {
	prompt?: string;
	suite?: string;
	judge?: EvalJudge;
	failOnRegression?: boolean;
}

export interface EvalRunResult {
	totalScore: number;
	cases: Awaited<ReturnType<EvalEngine["runSuite"]>>["results"];
}

export interface EvalApplyInput {
	prompt?: string;
	suite?: string;
	judge?: EvalJudge;
	bump?: "patch" | "minor" | "major";
	failOnRegression?: boolean;
}

export interface EvalSuggestInput {
	prompt?: string;
	suite?: string;
	judge?: EvalJudge;
}

export interface EvalHistoryInput {
	prompt?: string;
	suite?: string;
	historyFile?: string;
	limit?: number;
}

export interface EvalReportInput {
	prompt?: string;
	suite?: string;
	id?: string;
	historyFile?: string;
}

export interface EvalCompareInput {
	prompt?: string;
	suite?: string;
	base?: string;
	head?: string;
	historyFile?: string;
}

function ensurePromptSuite(input: { prompt?: string; suite?: string }) {
	if (!input.prompt || !input.suite) {
		return sdkError("invalid_input", "prompt and suite are required.", {
			fields: [!input.prompt ? "prompt" : null, !input.suite ? "suite" : null].filter(Boolean),
		});
	}
	return null;
}

export async function run(
	input: EvalRunInput,
): Promise<SdkResult<EvalRunResult>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	const engine = new EvalEngine();
	try {
		const suite = await engine.loadSuite(input.suite as string);
		const result = await engine.runSuite(suite, {
			judge: input.judge ?? "deterministic",
		});
		await appendHistory({
			id: randomUUID(),
			prompt: input.prompt as string,
			suite: input.suite as string,
			command: "run",
			totalScore: result.totalScore,
			judge: input.judge ?? "deterministic",
			meta: { failOnRegression: Boolean(input.failOnRegression) },
		});

		if (input.failOnRegression && result.totalScore < 1.0) {
			return {
				ok: false,
				error: sdkError("regression", "Score below threshold.", {
					score: result.totalScore,
				}),
			};
		}

		return { ok: true, data: { totalScore: result.totalScore, cases: result.results } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "Evaluation failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function apply(
	input: EvalApplyInput,
): Promise<SdkResult<{ bumpedTo?: string; totalScore: number }>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	const engine = new EvalEngine();
	try {
		const suite = await engine.loadSuite(input.suite as string);
		const result = await engine.runSuite(suite, {
			judge: input.judge ?? "deterministic",
		});
		if (input.failOnRegression && result.totalScore < 1.0) {
			return {
				ok: false,
				error: sdkError("regression", "Score below threshold.", {
					score: result.totalScore,
				}),
			};
		}

		const { PromptEngine } = await import("../features/prompt/engine");
		const { join } = await import("node:path");
		const promptEngine = new PromptEngine(
			join(process.cwd(), "src/features/prompt/templates"),
		);
		const bumpLevel = input.bump ?? "patch";
		const nextVersion = await promptEngine.bumpVersion(input.prompt as string, bumpLevel);

		await appendHistory({
			id: randomUUID(),
			prompt: input.prompt as string,
			suite: input.suite as string,
			command: "apply",
			totalScore: result.totalScore,
			judge: input.judge ?? "deterministic",
			meta: { bumpedTo: nextVersion },
		});

		return { ok: true, data: { bumpedTo: nextVersion, totalScore: result.totalScore } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "Apply failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function suggest(
	input: EvalSuggestInput,
): Promise<SdkResult<{ failures: number; totalScore: number }>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	const engine = new EvalEngine();
	try {
		const suite = await engine.loadSuite(input.suite as string);
		const result = await engine.runSuite(suite, {
			judge: input.judge ?? "deterministic",
		});
		const failures = result.results.filter((r) => !r.passed).length;
		await appendHistory({
			id: randomUUID(),
			prompt: input.prompt as string,
			suite: input.suite as string,
			command: "suggest",
			totalScore: result.totalScore,
			judge: input.judge ?? "deterministic",
			meta: { suggestions: failures },
		});
		return { ok: true, data: { failures, totalScore: result.totalScore } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "Suggest failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function history(
	input: EvalHistoryInput,
): Promise<SdkResult<EvalHistoryEntry[]>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	try {
		const entries = await loadHistory(process.cwd(), input.historyFile);
		const relevant = entries
			.filter((entry) => entry.prompt === input.prompt && entry.suite === input.suite)
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		const limit = Math.max(1, input.limit ?? 5);
		const slice = relevant.slice(-limit);
		return { ok: true, data: slice };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "History failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function report(
	input: EvalReportInput,
): Promise<SdkResult<EvalHistoryEntry>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	try {
		const entries = await loadHistory(process.cwd(), input.historyFile);
		const relevant = entries
			.filter((entry) => entry.prompt === input.prompt && entry.suite === input.suite)
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		const target = input.id
			? relevant.find((entry) => entry.id === input.id)
			: relevant[relevant.length - 1];
		if (!target) {
			return { ok: false, error: sdkError("not_found", "No matching history entry.") };
		}
		return { ok: true, data: target };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "Report failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function compare(
	input: EvalCompareInput,
): Promise<SdkResult<{ base: EvalHistoryEntry; head: EvalHistoryEntry; delta: number }>> {
	const validation = ensurePromptSuite(input);
	if (validation) return { ok: false, error: validation };
	try {
		const entries = await loadHistory(process.cwd(), input.historyFile);
		const relevant = entries
			.filter((entry) => entry.prompt === input.prompt && entry.suite === input.suite)
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		if (relevant.length < 2) {
			return { ok: false, error: sdkError("invalid_state", "Need at least two entries to compare.") };
		}

		const findById = (value?: string) =>
			value ? relevant.find((entry) => entry.id === value.trim()) : undefined;
		const headEntry = findById(input.head) ?? relevant[relevant.length - 1];
		const baseEntry = findById(input.base) ?? relevant[relevant.length - 2];

		if (!headEntry || !baseEntry) {
			return { ok: false, error: sdkError("not_found", "Could not find base/head entries.") };
		}

		return {
			ok: true,
			data: { base: baseEntry, head: headEntry, delta: headEntry.totalScore - baseEntry.totalScore },
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError("eval_error", "Compare failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const evalSdk = {
	run,
	apply,
	suggest,
	report,
	history,
	compare,
};
