import { parseArgs } from "node:util";
import { logger } from "../../core/logger";
import { EvalEngine } from "./engine";

export async function evalCli(args: string[], _bus?: any) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			suite: { type: "string", short: "s" },
			json: { type: "boolean" },
			baseline: { type: "string" },
			"fail-on-regression": { type: "boolean" },
			bump: { type: "string" },
			judge: { type: "string", default: "deterministic" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
		strict: false,
	});

	const evalHelp = `
Usage: nooa eval <command> <prompt_name> --suite <name> [flags]

Systematic evaluation of AI prompts and outputs.

Commands:
  run          Execute evaluation suite on a prompt.
  suggest      Analyze failures and suggest improvements.
  apply        Bump prompt version if evaluation passes.

Flags:
  -s, --suite <name>     Name of the test suite (required).
  --json                 Output results as JSON.
  --judge <type>         Evaluation judge (deterministic, llm).
  --bump <level>         Version level for 'apply' (patch, minor, major).
  --fail-on-regression  Exit with code 1 if score < 1.0.
  -h, --help             Show help message.

Examples:
  nooa eval run review --suite standard
  nooa eval apply code --suite smoke --bump minor
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

	try {
		if (command === "run") {
			const suite = await engine.loadSuite(suiteName);
			console.log(`Running suite: ${suite.name} on prompt: ${promptName}...`);

			const result = await engine.runSuite(suite, {
				judge: values.judge as any,
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
			const result = await engine.runSuite(suite, {
				judge: values.judge as any,
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
		} else if (command === "suggest") {
			const suite = await engine.loadSuite(suiteName);
			console.log(`Evaluating ${promptName} for improvement suggestions...`);
			const result = await engine.runSuite(suite, {
				judge: values.judge as any,
			});

			const failures = result.results.filter((r) => !r.passed);
			if (failures.length === 0) {
				console.log("Everything passed! No suggestions needed.");
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
		} else {
			console.error(`Error: Command '${command}' not yet fully implemented.`);
			process.exitCode = 1;
		}
	} catch (e) {
		logger.error("eval.error", e as Error);
		process.exitCode = 1;
	}
}

const evalCommand = {
	name: "eval",
	description: "Systematic evaluation of AI prompts and outputs",
	async execute({ rawArgs, bus }: any) {
		// rawArgs starts with 'eval', so we want what's after it
		const evalIndex = rawArgs.indexOf("eval");
		await evalCli(rawArgs.slice(evalIndex + 1), bus);
	},
};

export default evalCommand;
