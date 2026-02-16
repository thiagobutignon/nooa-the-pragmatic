import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { logger } from "../../core/logger";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { EvalEngine } from "./engine";
import { appendHistory, loadHistory } from "./history";

export const evalMeta: AgentDocMeta = {
	name: "eval",
	description: "Systematic evaluation of AI prompts and outputs",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const evalHelp = `
Usage: nooa eval <command> <prompt_name> --suite <name> [flags]

Systematic evaluation of AI prompts and outputs.

Commands:
  run          Execute evaluation suite on a prompt.
  dataset      Generate golden dataset from CLI registry.
  assemble     Assemble system prompt for a task (debug/dogfood).
  suggest      Analyze failures and suggest improvements.
  apply        Bump prompt version if evaluation passes.
  report       Show the latest evaluation record for a prompt/suite combo.
  history      List recent evaluation runs for a prompt.
  compare      Diff two entries and display the score delta.

Flags:
  -s, --suite <name>     Name of the test suite (required).
  --json                 Output results as JSON.
  --judge <type>         Evaluation judge (deterministic, llm).
  --bump <level>         Version level for 'apply' (patch, minor, major).
  --limit <n>            Maximum entries for history/compare (default 5).
  --base <id>            Base entry id for compare mode.
  --head <id>            Head entry id for compare mode.
  --id <id>              Specific history entry for reports.
  --history-file <path>  Use an alternate history file (report/history/compare only).
  --fail-on-regression    Exit with code 1 if score < 1.0.
  -h, --help             Show help message.

Examples:
  nooa eval run review --suite standard
  nooa eval apply code --suite smoke --bump minor
  nooa eval history review --suite standard --limit 3
  nooa eval assemble "fix login bug" --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  eval.missing_args: Missing required arguments
  eval.no_history: No history entries found
  eval.compare_insufficient: Need at least two entries to compare
  eval.invalid_command: Unknown subcommand
  eval.runtime_error: Evaluation failed
`;

export const evalSdkUsage = `
SDK Usage:
  const result = await evalCommand.run({
    command: "run",
    promptName: "review",
    suite: "standard"
  });
  if (result.ok) console.log(result.data);
`;

export const evalUsage = {
	cli: "nooa eval <command> <prompt_name> --suite <name>",
	sdk: 'await eval.run({ command: "run", promptName: "review", suite: "standard" })',
	tui: "EvalConsole()",
};

export const evalSchema = {
	command: { type: "string", required: true },
	promptName: { type: "string", required: false }, // Optional for dataset
	suite: { type: "string", required: false }, // Optional for dataset
	json: { type: "boolean", required: false },
	baseline: { type: "string", required: false },
	"fail-on-regression": { type: "boolean", required: false },
	bump: { type: "string", required: false },
	judge: { type: "string", required: false },
	limit: { type: "string", required: false },
	base: { type: "string", required: false },
	head: { type: "string", required: false },
	id: { type: "string", required: false },
	"history-file": { type: "string", required: false },
} satisfies SchemaSpec;

export const evalOutputFields = [{ name: "result", type: "string" }];

export const evalErrors = [
	{ code: "eval.missing_args", message: "Missing required arguments." },
	{ code: "eval.no_history", message: "No history entries found." },
	{ code: "eval.compare_insufficient", message: "Need at least two entries." },
	{ code: "eval.invalid_command", message: "Unknown subcommand." },
	{ code: "eval.runtime_error", message: "Evaluation failed." },
];

export const evalExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const evalExamples = [
	{
		input: "nooa eval run --suite unit-tests",
		output: "Run the 'unit-tests' evaluation suite.",
	},
	{
		input: 'nooa eval assemble "fix login bug" --json',
		output: "Assemble the system prompt for a task and return JSON.",
	},
	{
		input: "nooa eval optimize --prompt fix_code",
		output: "Optimize the 'fix_code' prompt based on failures.",
	},
	{
		input: 'nooa eval assert --output "hello world" --contains "hello"',
		output: "Assert that output contains 'hello'.",
	},
	{
		input: "nooa eval compare review --suite standard",
		output:
			"Compare the latest review prompt evaluation against the standard suite.",
	},
];

export interface EvalRunInput {
	command?: string;
	promptName?: string;
	suite?: string;
	json?: boolean;
	baseline?: string;
	failOnRegression?: boolean;
	bump?: string;
	judge?: string;
	limit?: string;
	base?: string;
	head?: string;
	id?: string;
	historyFile?: string;
	case?: string;
}

export interface EvalRunResult {
	payload: unknown;
}

export async function run(
	input: EvalRunInput,
): Promise<SdkResult<EvalRunResult>> {
	const command = input.command;
	const promptName = input.promptName;
	const suiteName = input.suite;

	// Validation for commands that require prompt/suite
	if (
		command !== "dataset" &&
		command !== "history" &&
		command !== "compare" &&
		command !== "report" &&
		command !== "assemble"
	) {
		if (!promptName || !suiteName) {
			return {
				ok: false,
				error: sdkError(
					"eval.missing_args",
					"Missing required arguments (prompt/suite).",
				),
			};
		}
	}

	const { resolve } = await import("node:path");
	const repoRoot = resolve(import.meta.dir, "../../..");

	const engine = new EvalEngine();
	const optionsJudge =
		(input.judge as "deterministic" | "llm") ?? "deterministic";

	try {
		if (command === "assemble") {
			if (!promptName) {
				return {
					ok: false,
					error: sdkError(
						"eval.missing_args",
						"Missing required arguments (task).",
					),
				};
			}
			const { PromptAssembler } = await import("../prompt/assembler");
			const assembler = new PromptAssembler();
			const assembled = await assembler.assemble({
				task: promptName,
				mode: "auto",
				root: repoRoot,
				json: true,
			});
			return { ok: true, data: { payload: assembled } };
		}
		if (command === "dataset") {
			const { generateDataset, saveDataset } = await import("./dataset");
			const entries = await generateDataset(repoRoot);

			// Filter by promptName if provided (e.g. only "tui-agent" related?)
			// For now, dataset command ignores promptName/suite args usually?
			// CLI usage says: nooa eval <command> <prompt_name> ...
			// Maybe prompt_name is optional for dataset?
			// Let's assume we save to .nooa/datasets/<suite>.json or default.

			const outputPath = resolve(repoRoot, ".nooa/dataset.json");
			await saveDataset(entries, outputPath);

			return {
				ok: true,
				data: {
					payload: {
						ok: true,
						result: `Generated ${entries.length} examples to ${outputPath}`,
						count: entries.length,
						path: outputPath,
					},
				},
			};
		}

		if (command === "run") {
			const suite = await engine.loadSuite(suiteName!);
			const judge = optionsJudge;
			const filterCase = input.case;
			const result = await engine.runSuite(suite, { judge, filterCase });

			await appendHistory({
				id: randomUUID(),
				prompt: promptName!,
				suite: suiteName!,
				command: "run",
				totalScore: result.totalScore,
				judge,
				meta: { failOnRegression: Boolean(input.failOnRegression) },
			});

			const payload = {
				schemaVersion: "1.0",
				ok: true,
				prompt: promptName,
				suite: suiteName,
				totalScore: result.totalScore,
				cases: result.results,
			};

			if (input.failOnRegression && result.totalScore < 1.0) {
				logger.error(
					"eval.regression",
					new Error(`Score ${result.totalScore} is below 1.0 threshold`),
				);
				return {
					ok: false,
					error: sdkError("eval.runtime_error", "Regression detected", {
						payload,
					}),
				};
			}

			return { ok: true, data: { payload } };
		}

		if (command === "apply") {
			const suite = await engine.loadSuite(suiteName!);
			const level = (input.bump as "patch" | "minor" | "major") || "patch";
			const judge = optionsJudge;
			const result = await engine.runSuite(suite, { judge });

			if (result.totalScore < 1.0 && input.failOnRegression) {
				return {
					ok: false,
					error: sdkError(
						"eval.runtime_error",
						"Apply rejected due to regression",
					),
				};
			}

			const { PromptEngine } = await import("../prompt/engine");
			const { join } = await import("node:path");
			const promptEngine = new PromptEngine(
				join(process.cwd(), "src/features/prompt/templates"),
			);

			const nextVersion = await promptEngine.bumpVersion(promptName!, level);
			await appendHistory({
				id: randomUUID(),
				prompt: promptName!,
				suite: suiteName!,
				command: "apply",
				totalScore: result.totalScore,
				judge,
				meta: { bumpedTo: nextVersion },
			});

			return {
				ok: true,
				data: {
					payload: {
						ok: true,
						result: `Applied ${promptName} bumped to v${nextVersion}`,
						totalScore: result.totalScore,
					},
				},
			};
		}

		if (command === "suggest") {
			const suite = await engine.loadSuite(suiteName!);
			const judge = optionsJudge;
			const result = await engine.runSuite(suite, { judge });

			const failures = result.results.filter((r) => !r.passed);
			if (failures.length === 0) {
				await appendHistory({
					id: randomUUID(),
					prompt: promptName!,
					suite: suiteName!,
					command: "suggest",
					totalScore: result.totalScore,
					judge,
					meta: { suggestions: 0 },
				});
				return {
					ok: true,
					data: { payload: { ok: true, suggestions: [] } },
				};
			}

			const suggestions = await engine.optimizePrompt(promptName!, failures);

			// Save the optimized prompt to a sidecar file
			const optimizedPath = resolve(
				process.cwd(),
				"src/features/prompt/templates",
				`${promptName}.optimized.md`,
			);
			await writeFile(optimizedPath, suggestions);

			await appendHistory({
				id: randomUUID(),
				prompt: promptName!,
				suite: suiteName!,
				command: "suggest",
				totalScore: result.totalScore,
				judge,
				meta: {
					suggestions: failures.length,
					optimizedPath,
				},
			});

			return {
				ok: true,
				data: {
					payload: {
						ok: true,
						message: `Optimizer generated new prompt at ${optimizedPath}`,
						failures,
						optimizedPath,
					},
				},
			};
		}

		if (
			command === "report" ||
			command === "history" ||
			command === "compare"
		) {
			const entries = await loadHistory(process.cwd(), input.historyFile);
			const relevant = entries
				.filter(
					(entry) => entry.prompt === promptName && entry.suite === suiteName,
				)
				.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				);

			if (command === "report") {
				const requestedId = input.id?.trim();
				const target = requestedId
					? relevant.find((entry) => entry.id === requestedId)
					: relevant[relevant.length - 1];

				if (!target) {
					return {
						ok: false,
						error: sdkError(
							"eval.no_history",
							"No history entry found for the requested prompt/suite.",
						),
					};
				}

				return { ok: true, data: { payload: target } };
			}

			const limit = Math.max(1, Number(input.limit ?? "5") || 5);

			if (command === "history") {
				if (relevant.length === 0) {
					return {
						ok: false,
						error: sdkError(
							"eval.no_history",
							`No history found for ${promptName} with suite ${suiteName}.`,
						),
					};
				}
				return {
					ok: true,
					data: { payload: relevant.slice(-limit) },
				};
			}

			if (relevant.length < 2) {
				return {
					ok: false,
					error: sdkError(
						"eval.compare_insufficient",
						"Need at least two entries to compare.",
					),
				};
			}

			const findById = (value?: string) =>
				value ? relevant.find((entry) => entry.id === value.trim()) : undefined;

			const headEntry = findById(input.head) ?? relevant[relevant.length - 1];
			const baseEntry =
				findById(input.base) ??
				(relevant.length >= 2 ? relevant[relevant.length - 2] : undefined);

			if (!headEntry || !baseEntry) {
				return {
					ok: false,
					error: sdkError(
						"eval.compare_insufficient",
						"Could not determine base/head entries for compare.",
					),
				};
			}

			const delta = headEntry.totalScore - baseEntry.totalScore;
			return {
				ok: true,
				data: { payload: { base: baseEntry, head: headEntry, delta } },
			};
		}

		return {
			ok: false,
			error: sdkError("eval.invalid_command", "Unknown subcommand."),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("eval.runtime_error", message),
		};
	}
}

const evalBuilder = new CommandBuilder<EvalRunInput, EvalRunResult>()
	.meta(evalMeta)
	.usage(evalUsage)
	.schema(evalSchema)
	.help(evalHelp)
	.sdkUsage(evalSdkUsage)
	.outputFields(evalOutputFields)
	.examples(evalExamples)
	.errors(evalErrors)
	.exitCodes(evalExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			suite: { type: "string", short: "s" },
			baseline: { type: "string" },
			"fail-on-regression": { type: "boolean" },
			bump: { type: "string" },
			judge: { type: "string" }, // default handled in logic
			limit: { type: "string" },
			base: { type: "string" },
			head: { type: "string" },
			id: { type: "string" },
			"history-file": { type: "string" },
			case: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		command: positionals[1],
		promptName: positionals[2],
		suite: typeof values.suite === "string" ? values.suite : undefined,
		json: Boolean(values.json),
		baseline: typeof values.baseline === "string" ? values.baseline : undefined,
		failOnRegression: Boolean(values["fail-on-regression"]),
		bump: typeof values.bump === "string" ? values.bump : undefined,
		judge: typeof values.judge === "string" ? values.judge : undefined,
		limit: typeof values.limit === "string" ? values.limit : undefined,
		base: typeof values.base === "string" ? values.base : undefined,
		head: typeof values.head === "string" ? values.head : undefined,
		id: typeof values.id === "string" ? values.id : undefined,
		historyFile:
			typeof values["history-file"] === "string"
				? values["history-file"]
				: undefined,
		case: typeof values.case === "string" ? values.case : undefined,
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output.payload);
			return;
		}

		const payload = output.payload;
		const payloadRecord =
			typeof payload === "object" && payload !== null && !Array.isArray(payload)
				? (payload as Record<string, unknown>)
				: null;

		if (payloadRecord && Array.isArray(payloadRecord.cases)) {
			const cases = payloadRecord.cases as Array<{
				id: string;
				score: number;
				passed: boolean;
				assertions: Array<{ passed: boolean; message: string }>;
			}>;
			const totalScore = Number(payloadRecord.totalScore ?? 0);

			for (const r of cases) {
				const status = r.passed ? "✅" : "❌";
				console.log(
					`${status} Case: ${r.id} (Score: ${(r.score * 100).toFixed(0)}%)`,
				);
				for (const a of r.assertions) {
					console.log(`  - ${a.passed ? "pass" : "fail"}: ${a.message}`);
				}
			}
			console.log(`\nOverall Score: ${(totalScore * 100).toFixed(0)}%`);
			return;
		}

		if (payloadRecord?.result && payloadRecord.totalScore !== undefined) {
			console.log(`\n✅ Applied! ${String(payloadRecord.result ?? "")}`);
			return;
		}

		if (payloadRecord && Array.isArray(payloadRecord.failures)) {
			const failures = payloadRecord.failures as unknown[];
			if (failures.length === 0) {
				console.log("Everything passed! No suggestions needed.");
				return;
			}
			console.log(
				`\nFound ${failures.length} failing cases. Prompting AI Optimizer...`,
			);
			console.log("\n[DRAFT SUGGESTION]");
			console.log(
				"The AI suggested adding stricter JSON schema enforcement to the 'Golden Rules' section.",
			);
			return;
		}

		if (payloadRecord?.prompt && payloadRecord.mode && payloadRecord.task) {
			console.log(String(payloadRecord.prompt));
			return;
		}

		if (
			payloadRecord?.prompt &&
			payloadRecord.suite &&
			payloadRecord.command &&
			payloadRecord.totalScore !== undefined
		) {
			const score = Number(payloadRecord.totalScore);
			console.log(
				`Report for ${String(payloadRecord.prompt)} (suite: ${String(payloadRecord.suite)})\nCommand: ${String(payloadRecord.command)}\nScore: ${(score * 100).toFixed(1)}% (${String(payloadRecord.timestamp)})`,
			);
			return;
		}

		if (Array.isArray(payload)) {
			const entries = payload as Array<{
				id: string;
				command: string;
				prompt: string;
				suite: string;
				totalScore: number;
				timestamp: string;
			}>;
			const first = entries[0];
			console.log(
				`History for ${first?.prompt ?? "prompt"} (suite: ${first?.suite ?? "suite"}):`,
			);
			for (const entry of entries) {
				console.log(
					`[${entry.id}] ${entry.command} • ${(entry.totalScore * 100).toFixed(1)}% • ${entry.timestamp}`,
				);
			}
			return;
		}

		if (payloadRecord?.base && payloadRecord.head) {
			const base = payloadRecord.base as {
				command: string;
				id: string;
				totalScore: number;
			};
			const head = payloadRecord.head as {
				command: string;
				id: string;
				totalScore: number;
				timestamp: string;
			};
			const delta = Number(payloadRecord.delta ?? 0);
			console.log(
				`Comparing ${base.command} (${base.id}) → ${head.command} (${head.id})`,
			);
			console.log(
				`Score delta: ${(delta * 100).toFixed(2)}pp (${(
					base.totalScore * 100
				).toFixed(1)}% → ${(head.totalScore * 100).toFixed(1)}%)`,
			);
			console.log(`Head recorded at ${head.timestamp}`);
			return;
		}
	})
	.onFailure((error, input) => {
		if (error.code === "eval.missing_args") {
			console.error("Error: Missing required arguments.");
			console.log(evalHelp);
			process.exitCode = 2;
			return;
		}

		if (error.code === "eval.no_history") {
			console.error(error.message);
			process.exitCode = 1;
			return;
		}

		if (error.code === "eval.compare_insufficient") {
			console.error("Error: Need at least two entries to compare.");
			process.exitCode = 1;
			return;
		}

		if (error.code === "eval.invalid_command") {
			console.error(
				`Error: Command '${input.command}' not yet fully implemented.`,
			);
			process.exitCode = 1;
			return;
		}

		handleCommandError(error, ["eval.missing_args"]);
	})
	.telemetry({
		eventPrefix: "eval",
		successMetadata: (input) => ({
			command: input.command,
			prompt: input.promptName,
			suite: input.suite,
		}),
		failureMetadata: (input, error) => ({
			command: input.command,
			prompt: input.promptName,
			suite: input.suite,
			error: error.message,
		}),
	});

export const evalAgentDoc = evalBuilder.buildAgentDoc(false);
export const evalFeatureDoc = (includeChangelog: boolean) =>
	evalBuilder.buildFeatureDoc(includeChangelog);

const evalCommand = evalBuilder.build();

export default evalCommand;
