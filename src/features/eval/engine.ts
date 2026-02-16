import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCommands } from "../../core/registry";
import { AiEngine } from "../ai/engine";
import {
	GroqProvider,
	MockProvider,
	OllamaProvider,
	OpenAiProvider,
} from "../ai/providers/mod";
import { PromptAssembler } from "../prompt/assembler";
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

	async buildSystemPrompt(options: {
		promptName: string;
		inputText: string;
		vars: Record<string, unknown>;
		root: string;
	}) {
		const templatesDir = join(options.root, "src/features/prompt/templates");
		const promptEngine = new PromptEngine(templatesDir);
		const promptTemplate = await promptEngine.loadPrompt(options.promptName);

		const featuresDir = join(options.root, "src/features");
		const registry = await loadCommands(featuresDir);
		const toolsList = registry
			.list()
			.map((cmd) => {
				let examples = "";
				if (cmd.examples && cmd.examples.length > 0) {
					examples =
						"\n  Examples:\n" +
						cmd.examples
							.map(
								(ex) => `  - Input: "${ex.input}"\n    Output: "${ex.output}"`,
							)
							.join("\n");
				}
				return `- **${cmd.name}**: ${cmd.description}${examples}`;
			})
			.join("\n\n");

		const renderedPrompt = await promptEngine.renderPrompt(promptTemplate, {
			...options.vars,
			input: options.inputText,
			repo_root: options.root,
			tools: toolsList,
		});

		const assembler = new PromptAssembler();
		const assembled = await assembler.assemble({
			task: options.inputText,
			mode: "auto",
			root: options.root,
		});

		return [String(assembled), renderedPrompt].join("\n\n---\n\n");
	}

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
		options: { judge?: "deterministic" | "llm"; filterCase?: string } = {},
	): Promise<{ results: CaseResult[]; totalScore: number }> {
		const results: CaseResult[] = [];
		const aiEngine = new AiEngine();
		aiEngine.register(new OllamaProvider());
		aiEngine.register(new OpenAiProvider());
		aiEngine.register(new MockProvider());
		aiEngine.register(new GroqProvider());

		const judgeTemplate =
			options.judge === "llm"
				? await new PromptEngine(
						join(process.cwd(), "src/features/prompt/templates"),
					).loadPrompt("eval-rubric")
				: null;

		const filteredCases = options.filterCase
			? suite.cases.filter((c) => c.id === options.filterCase)
			: suite.cases;

		for (const c of filteredCases) {
			let inputText = c.input_text || "";
			if (c.input && !c.input_text) {
				inputText = await readFile(join(process.cwd(), c.input), "utf-8");
			}

			const systemPrompt = await this.buildSystemPrompt({
				promptName: suite.prompt,
				inputText,
				vars: c.vars,
				root: process.cwd(),
			});

			const messages: {
				role: "system" | "user" | "assistant";
				content: string;
			}[] = [{ role: "system", content: systemPrompt }];
			if (inputText) {
				messages.push({ role: "user", content: inputText });
			}

			const response = await aiEngine.complete(
				{
					messages,
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
				const judgePrompt = await new PromptEngine(
					join(process.cwd(), "src/features/prompt/templates"),
				).renderPrompt(
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

	async optimizePrompt(
		promptName: string,
		failures: CaseResult[],
	): Promise<string> {
		const templatesDir = join(process.cwd(), "src/features/prompt/templates");
		const promptEngine = new PromptEngine(templatesDir);
		const aiEngine = new AiEngine();
		// Register providers (ensure they are registered if not already in constructor/runSuite)
		aiEngine.register(new OllamaProvider());
		aiEngine.register(new OpenAiProvider());
		aiEngine.register(new MockProvider());
		aiEngine.register(new GroqProvider());

		const originalPrompt = await promptEngine.loadPrompt(promptName);
		const optimizerTemplate = await promptEngine.loadPrompt("optimizer-prompt");

		const failuresText = failures
			.map((f) => {
				const assertions = f.assertions
					.filter((a) => !a.passed)
					.map((a) => `- ${a.message}`)
					.join("\n");
				return `### Case ID: ${f.id}\n**Input:**\n${f.output}\n\n**Failed Assertions:**\n${assertions}\n`;
			})
			.join("\n---\n");

		const _systemPrompt = await promptEngine.renderPrompt(
			optimizerTemplate,
			{
				original_prompt: originalPrompt.body, // or full raw content if available, ideally we reconstruct it
				failures: failuresText,
			},
			{ skipAgentContext: true },
		);

		// We need the raw frontmatter + body for the optimizer to rewrite the whole file
		// promptEngine.loadPrompt returns parsed object.
		// Let's read the raw file for the "Original Prompt" section to be perfect.
		const rawOriginal = await readFile(
			join(templatesDir, `${promptName}.md`),
			"utf-8",
		);

		const optimizationPrompt = await promptEngine.renderPrompt(
			optimizerTemplate,
			{
				original_prompt: rawOriginal,
				failures: failuresText,
			},
			{ skipAgentContext: true },
		);

		const response = await aiEngine.complete(
			{
				messages: [{ role: "user", content: optimizationPrompt }],
				traceId: `opt-${promptName}-${Date.now()}`,
			},
			{
				provider: process.env.NOOA_AI_PROVIDER || "groq",
			},
		);

		return response.content;
	}
}
