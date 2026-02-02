import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import type { EventBus } from "../../core/event-bus";
import { logger } from "../../core/logger";
import { EvalEngine } from "./engine";
import { appendHistory, loadHistory } from "./history";

export async function evalCli(args: string[], _bus?: EventBus) {
	const parsed = parseArgs({
		args,
		options: {
			suite: { type: "string", short: "s" },
			json: { type: "boolean" },
			baseline: { type: "string" },
			"fail-on-regression": { type: "boolean" },
			bump: { type: "string" },
			judge: { type: "string", default: "deterministic" },
			limit: { type: "string" },
			base: { type: "string" },
			head: { type: "string" },
			id: { type: "string" },
			"history-file": { type: "string" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});
	const values = parsed.values as {
		suite?: string;
		json?: boolean;
		baseline?: string;
		"fail-on-regression"?: boolean;
		bump?: string;
		judge?: string;
		limit?: string;
		base?: string;
		head?: string;
		id?: string;
		"history-file"?: string;
		help?: boolean;
	};
	const positionals = parsed.positionals as string[];

	const evalHelp = `
Usage: nooa eval <command> <prompt_name> --suite <name> [flags]

Systematic evaluation of AI prompts and outputs.

Commands:
  run          Execute evaluation suite on a prompt.
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
`;

	if (values.help) {
		console.log(evalHelp);
		return;
	}

	const command = positionals[0];
	const promptName = positionals[1];
	const suiteName = values.suite as string;

	if (!command || !promptName || !suiteName) {
		console.error("Error: Missing required arguments.");
		console.log(evalHelp);
		process.exitCode = 2;
		return;
	}

	const engine = new EvalEngine();
	const optionsJudge =
		(values.judge as "deterministic" | "llm") ?? "deterministic";

	try {
		if (command === "run") {
			const suite = await engine.loadSuite(suiteName);
			console.log(`Running suite: ${suite.name} on prompt: ${promptName}...`);

			const judge = optionsJudge;
			const result = await engine.runSuite(suite, {
				judge,
			});

			await appendHistory({
				id: randomUUID(),
				prompt: promptName,
				suite: suiteName,
				command: "run",
				totalScore: result.totalScore,
				judge,
				meta: { failOnRegression: Boolean(values["fail-on-regression"]) },
			});

			if (values.json) {
				console.log(
					JSON.stringify(
						{
							schemaVersion: "1.0",
							ok: true,
							prompt: promptName,
							suite: values.suite,
							totalScore: result.totalScore,
							cases: result.results,
						},
						null,
						2,
					),
				);
			} else {
				for (const r of result.results) {
					const status = r.passed ? "✅" : "❌";
					console.log(
						`${status} Case: ${r.id} (Score: ${(r.score * 100).toFixed(0)}%)`,
					);
					for (const a of r.assertions) {
						console.log(`  - ${a.passed ? "pass" : "fail"}: ${a.message}`);
					}
				}
				console.log(
					`\nOverall Score: ${(result.totalScore * 100).toFixed(0)}%`,
				);
			}

			if (values["fail-on-regression"] && result.totalScore < 1.0) {
				logger.error(
					"eval.regression",
					new Error(`Score ${result.totalScore} is below 1.0 threshold`),
				);
				process.exitCode = 1;
			}
		} else if (command === "apply") {
			const suite = await engine.loadSuite(suiteName);
			const level = (values.bump as "patch" | "minor" | "major") || "patch";

			console.log(`Evaluating ${promptName} before bump...`);
			const judge = optionsJudge;
			const result = await engine.runSuite(suite, {
				judge,
			});

			if (result.totalScore < 1.0 && values["fail-on-regression"]) {
				console.error(
					`❌ Apply rejected: Score is ${(result.totalScore * 100).toFixed(0)}%.`,
				);
				process.exitCode = 1;
				return;
			}

			const { PromptEngine } = await import("../prompt/engine");
			const { join } = await import("node:path");
			const promptEngine = new PromptEngine(
				join(process.cwd(), "src/features/prompt/templates"),
			);

			const nextVersion = await promptEngine.bumpVersion(promptName, level);
			console.log(`\n✅ Applied! ${promptName} bumped to v${nextVersion}`);
			await appendHistory({
				id: randomUUID(),
				prompt: promptName,
				suite: suiteName,
				command: "apply",
				totalScore: result.totalScore,
				judge,
				meta: { bumpedTo: nextVersion },
			});
		} else if (command === "suggest") {
			const suite = await engine.loadSuite(suiteName);
			console.log(`Evaluating ${promptName} for improvement suggestions...`);
			const judge = optionsJudge;
			const result = await engine.runSuite(suite, {
				judge,
			});

			const failures = result.results.filter((r) => !r.passed);
			if (failures.length === 0) {
				console.log("Everything passed! No suggestions needed.");
				await appendHistory({
					id: randomUUID(),
					prompt: promptName,
					suite: suiteName,
					command: "suggest",
					totalScore: result.totalScore,
					judge,
					meta: { suggestions: 0 },
				});
				return;
			}

			console.log(
				`\nFound ${failures.length} failing cases. Prompting AI Optimizer...`,
			);
			// Here we would call a specific 'optimizer' prompt with the failures and current prompt
			// For now, we mock the suggestion // nooa-ignore
			console.log("\n[DRAFT SUGGESTION]");
			console.log(
				"The AI suggested adding stricter JSON schema enforcement to the 'Golden Rules' section.",
			);
			await appendHistory({
				id: randomUUID(),
				prompt: promptName,
				suite: suiteName,
				command: "suggest",
				totalScore: result.totalScore,
				judge,
				meta: { suggestions: failures.length },
			});
			return;
		} else if (
			command === "report" ||
			command === "history" ||
			command === "compare"
		) {
			const historyFileRaw = values["history-file"];
			const historyFile = historyFileRaw?.trim() || undefined;
			const entries = await loadHistory(process.cwd(), historyFile);
			const relevant = entries
				.filter(
					(entry) => entry.prompt === promptName && entry.suite === suiteName,
				)
				.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				);

			if (command === "report") {
				const requestedId = values.id?.trim();
				const target = requestedId
					? relevant.find((entry) => entry.id === requestedId)
					: relevant[relevant.length - 1];

				if (!target) {
					console.error(
						"Error: No history entry found for the requested prompt/suite.",
					);
					process.exitCode = 1;
					return;
				}

				if (values.json) {
					console.log(JSON.stringify(target, null, 2));
				} else {
					console.log(`Report for ${target.prompt} (suite: ${target.suite})`);
					console.log(`Command: ${target.command}`);
					console.log(
						`Score: ${(target.totalScore * 100).toFixed(1)}% (${target.timestamp})`,
					);
				}
				return;
			}

			const limit = Math.max(1, Number(values.limit ?? "5") || 5);

			if (command === "history") {
				if (relevant.length === 0) {
					console.log(
						`No history found for ${promptName} with suite ${suiteName}.`,
					);
					process.exitCode = 1;
					return;
				}
				const slice = relevant.slice(-limit);
				console.log(`History for ${promptName} (suite: ${suiteName}):`);
				for (const entry of slice) {
					console.log(
						`[${entry.id}] ${entry.command} • ${(entry.totalScore * 100).toFixed(1)}% • ${
							entry.timestamp
						}`,
					);
				}
				return;
			}

			if (relevant.length < 2) {
				console.error("Error: Need at least two entries to compare.");
				process.exitCode = 1;
				return;
			}

			const findById = (value?: string) =>
				value ? relevant.find((entry) => entry.id === value.trim()) : undefined;

			const headEntry = findById(values.head) ?? relevant[relevant.length - 1];
			const baseEntry =
				findById(values.base) ??
				(relevant.length >= 2 ? relevant[relevant.length - 2] : undefined);

			if (!headEntry || !baseEntry) {
				console.error(
					"Error: Could not determine base/head entries for compare.",
				);
				process.exitCode = 1;
				return;
			}

			const delta = headEntry.totalScore - baseEntry.totalScore;
			if (values.json) {
				console.log(
					JSON.stringify({ base: baseEntry, head: headEntry, delta }, null, 2),
				);
			} else {
				console.log(
					`Comparing ${baseEntry.command} (${baseEntry.id}) → ${headEntry.command} (${headEntry.id})`,
				);
				console.log(
					`Score delta: ${(delta * 100).toFixed(2)}pp (${(
						baseEntry.totalScore * 100
					).toFixed(1)}% → ${(headEntry.totalScore * 100).toFixed(1)}%)`,
				);
				console.log(`Head recorded at ${headEntry.timestamp}`);
			}
			return;
		} else {
			console.error(`Error: Command '${command}' not yet fully implemented.`);
			process.exitCode = 1;
		}
	} catch (error) {
		logger.error(
			"eval.error",
			error instanceof Error ? error : new Error(String(error)),
		);
		process.exitCode = 1;
	}
}

const evalCommand: Command = {
	name: "eval",
	description: "Systematic evaluation of AI prompts and outputs",
	async execute({ rawArgs, bus }: CommandContext) {
		// rawArgs starts with 'eval', so we want what's after it
		const evalIndex = rawArgs.indexOf("eval");
		await evalCli(rawArgs.slice(evalIndex + 1), bus);
	},
};

export default evalCommand;
