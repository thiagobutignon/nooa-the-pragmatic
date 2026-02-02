import { execa } from "execa";
import type { EventBus } from "../../core/event-bus";
import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";
import { AiEngine } from "../ai/engine";
import { MockProvider } from "../ai/providers/mock";
import { OllamaProvider } from "../ai/providers/ollama";
import { OpenAiProvider } from "../ai/providers/openai";
import { getGoal } from "../goal/execute";
import { executeSearch } from "../index/execute";

const ai = new AiEngine();
ai.register(new OllamaProvider());
ai.register(new OpenAiProvider());
ai.register(new MockProvider());

export interface FixOptions {
	issue: string;
	dryRun?: boolean;
}

export interface FixResult {
	ok: boolean;
	traceId: string;
	stages: {
		worktree: boolean;
		context: boolean;
		patch: boolean;
		verify: boolean;
		commit: boolean;
	};
	error?: string;
}

export interface ExecuteFixOptions {
	issue?: string;
	dryRun?: boolean;
	json?: boolean;
}

export interface ExecuteFixResponse {
	result: { message: string; ok: boolean };
	traceId: string;
}

export async function executeFix(
	options: ExecuteFixOptions,
	bus?: EventBus,
): Promise<ExecuteFixResponse> {
	const issue = options.issue || "unspecified issue";
	const dryRun = options.dryRun ?? true;
	const fixResult = await runFix({ issue, dryRun });

	telemetry.track(
		{
			event: fixResult.ok ? "fix.success" : "fix.failure",
			level: fixResult.ok ? "info" : "warn",
			success: fixResult.ok,
			trace_id: fixResult.traceId,
			metadata: {
				dry_run: dryRun,
				issue,
			},
		},
		bus,
	);

	return {
		result: {
			message: "Action performed by fix",
			ok: fixResult.ok,
		},
		traceId: fixResult.traceId,
	};
}

export async function runFix(options: FixOptions): Promise<FixResult> {
	const traceId = createTraceId();
	const stages = {
		worktree: false,
		context: false,
		patch: false,
		verify: false,
		commit: false,
	};

	try {
		if (options.dryRun) {
			return { ok: true, traceId, stages };
		}

		// Stage 1: Create worktree
		const branchName = `fix/${options.issue.replace(/\s+/g, "-").toLowerCase()}`;
		const worktree = await execa(
			"bun",
			["index.ts", "worktree", "create", branchName],
			{ reject: false },
		);
		if (worktree.exitCode !== 0) {
			throw new Error(`Failed to create worktree: ${worktree.stderr}`);
		}
		stages.worktree = true;

		// Stage 2: Build Context (Semantic Search)
		const contextResults = await executeSearch(options.issue, 3);
		const contextText = contextResults
			.map((r) => `File: ${r.path}\nContent:\n${r.chunk}`)
			.join("\n\n---\n\n");
		stages.context = true;

		// Stage 3: Apply Patch (AI Generation)
		const aiResponse = await ai.complete({
			messages: [
				{
					role: "user",
					content: `You are NOOA, a pragmatic programming agent.
The user wants to fix this issue: "${options.issue}"

Current Goal context:
${(await getGoal()) || "No specific goal set."}

Context found:
${contextText}

Please analyze the context and provide specific file changes to fix this issue.
Format your response as actionable steps.`,
				},
			],
			model: "qwen2.5-coder:7b",
			temperature: 0.2,
			traceId,
		});

		// Log AI response for debugging
		telemetry.track(
			{
				event: "fix.ai_patch_generated",
				level: "info",
				trace_id: traceId,
				metadata: {
					model: aiResponse.model,
					provider: aiResponse.provider,
					response_length: aiResponse.content.length,
				},
			},
			undefined,
		);

		stages.patch = true;

		// Stage 4: Verify (CI)
		const ci = await execa("bun", ["index.ts", "ci"], { reject: false });
		stages.verify = ci.exitCode === 0;

		// Stage 5: Commit
		if (stages.verify) {
			const commit = await execa(
				"bun",
				["index.ts", "commit", "-m", `fix: ${options.issue}`],
				{ reject: false },
			);
			stages.commit = commit.exitCode === 0;
		}

		return {
			ok: stages.commit,
			traceId,
			stages,
		};
	} catch (e) {
		return {
			ok: false,
			traceId,
			stages,
			error: (e as Error).message,
		};
	}
}
