import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AiEngine } from "../ai/engine";
import {
	MockProvider,
	OllamaProvider,
	OpenAiProvider,
} from "../ai/providers/mod";
import { PromptEngine } from "../prompt/engine";
import type { Assertion, AssertionResult } from "./scorers/deterministic";
import { DeterministicScorer } from "./scorers/deterministic";

export interface EvalCase {
	id: string;
	vars: Record<string, unknown>;
	input?: string; // Path relative to repo root
	input_text?: string;
	assertions: Assertion[];
}

export interface EvalSuite {
	name: string;
	prompt: string;
	cases: EvalCase[];
}

export interface CaseResult {
	id: string;
	passed: boolean;
	score: number;
	assertions: AssertionResult[];
	output: string;
}

export class EvalEngine {
	private scorer = new DeterministicScorer();

	async loadSuite(name: string): Promise<EvalSuite> {
		const suitePath = join(
			process.cwd(),
			"src/features/eval/suites",
			`${name}.json`,
		);
		const content = await readFile(suitePath, "utf-8");
		return JSON.parse(content);
	}

	async runSuite(
		suite: EvalSuite,
		options: { judge?: "deterministic" | "llm" } = {},
	): Promise<{ results: CaseResult[]; totalScore: number }> {
		const results: CaseResult[] = [];
		const templatesDir = join(process.cwd(), "src/features/prompt/templates");
		const promptEngine = new PromptEngine(templatesDir);
		const aiEngine = new AiEngine();
		aiEngine.register(new OllamaProvider());
		aiEngine.register(new OpenAiProvider());
		aiEngine.register(new MockProvider());

		const promptTemplate = await promptEngine.loadPrompt(suite.prompt);
		const judgeTemplate =
			options.judge === "llm"
				? await promptEngine.loadPrompt("eval-rubric")
				: null;

		for (const c of suite.cases) {
			let inputText = c.input_text || "";
			if (c.input && !c.input_text) {
				inputText = await readFile(join(process.cwd(), c.input), "utf-8");
			}

			const systemPrompt = await promptEngine.renderPrompt(promptTemplate, {
				...c.vars,
				input: inputText,
				repo_root: process.cwd(),
			});

			const response = await aiEngine.complete(
				{
					messages: [{ role: "system", content: systemPrompt }],
					traceId: `eval-${c.id}`,
				},
				{
					provider: process.env.NOOA_AI_PROVIDER || "ollama",
				},
			);

			const deterministicResult = this.scorer.score(
				response.content,
				c.assertions,
			);
			const assertions = [...deterministicResult.results];

			if (judgeTemplate) {
				const judgePrompt = await promptEngine.renderPrompt(
					judgeTemplate,
					{
						original_prompt: promptTemplate.body,
						input_data: inputText,
						ai_output: response.content,
					},
					{ skipAgentContext: true },
				);

				const judgeResponse = await aiEngine.complete(
					{
						messages: [{ role: "system", content: judgePrompt }],
						traceId: `judge-${c.id}`,
					},
					{
						provider: process.env.NOOA_AI_PROVIDER || "ollama",
					},
				);

				try {
					const jsonMatch = judgeResponse.content.match(/\{[\s\S]*\}/);
					const judgeResult = JSON.parse(
						jsonMatch ? jsonMatch[0] : judgeResponse.content,
					);
					assertions.push({
						passed: judgeResult.score >= 4,
						message: `LLM Judge: ${judgeResult.critique} (Score: ${judgeResult.score}/5)`,
					});
				} catch (e) {
					assertions.push({
						passed: false,
						message: `LLM Judge failed to parse: ${(e as Error).message}`,
					});
				}
			}

			const passedCount = assertions.filter((r) => r.passed).length;
			results.push({
				id: c.id,
				passed: passedCount === assertions.length,
				score: assertions.length > 0 ? passedCount / assertions.length : 0,
				assertions,
				output: response.content,
			});
		}

		const avgScore =
			results.length > 0
				? results.reduce((acc, r) => acc + r.score, 0) / results.length
				: 0;

		return { results, totalScore: avgScore };
	}
}
