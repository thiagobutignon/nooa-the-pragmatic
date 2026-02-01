import { execa } from "execa";
import { createTraceId } from "../../core/logger";
import { executeSearch } from "../index/execute";
import { AiEngine } from "../ai/engine";
import { OllamaProvider } from "../ai/providers/ollama";
import { OpenAiProvider } from "../ai/providers/openai";
import { MockProvider } from "../ai/providers/mock";

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
		// Note: In a real scenario, we'd use the AI to generate the file changes.
		// For now, we'll simulate the AI loop or provide a hook.
		const aiPrompt = `
        You are NOOA, a pragmatic programming agent.
        The user wants to fix this issue: "${options.issue}"
        
        Context found:
        ${contextText}
        
        Please provide a fix. (SIMULATED FOR NOW)
        `;
		
        // Simulation of AI completing the task (simulated)
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
