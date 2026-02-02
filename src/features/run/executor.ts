import { join } from "node:path";
import { execa } from "execa";
import type { Command } from "../../core/command";
import type { EventBus } from "../../core/event-bus";
import { loadCommands } from "../../core/registry";
import type {
	PipelineResult,
	PipelineStep,
	RunOptions,
	StepResult,
} from "./types";

export async function executePipeline(
	steps: PipelineStep[],
	options: RunOptions,
	bus?: EventBus,
): Promise<PipelineResult> {
	const results: StepResult[] = [];
	let failedStepIndex: number | undefined;

	// Load registry for internal commands
	// We assume features dir is at ../../features relative to this file
	const featuresDir = join(__dirname, "../../../src/features");
	const registry = await loadCommands(featuresDir);

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		if (!step) continue;
		const startTime = Date.now();

		try {
			if (step.kind === "external") {
				// Explicit 'exec' prefix used in parser
				const output = await executeExternal(step, options);
				results.push({
					step,
					exitCode: 0,
					durationMs: Date.now() - startTime,
					stdout: output?.stdout,
					stderr: output?.stderr,
				});
			} else {
				// Internal or Implicit External
				const cmdName = step.argv[0] || "";
				const command = registry.get(cmdName);

				if (command) {
					await executeInternal(step, command, bus);
					results.push({
						step,
						exitCode: 0,
						durationMs: Date.now() - startTime,
					});
				} else {
					// Not found in registry AND not marked external explicitly
					if (options.allowExternal) {
						const output = await executeExternal(step, options);
						results.push({
							step,
							exitCode: 0,
							durationMs: Date.now() - startTime,
							stdout: output?.stdout,
							stderr: output?.stderr,
						});
					} else {
						const cmdNameDisplay = cmdName || "unknown";
						throw new Error(
							`Unknown internal command: '${cmdNameDisplay}'. To run external commands, use the 'exec' prefix or --allow-external flag.`,
						);
					}
				}
			}
		} catch (error) {
			const err = error as {
				exitCode?: number;
				message?: string;
				stderr?: string;
			};
			const exitCode = err.exitCode ?? 1;
			results.push({
				step,
				exitCode,
				durationMs: Date.now() - startTime,
				error: err.message ?? String(error),
				stderr: err.stderr,
			});

			if (!options.continueOnError) {
				failedStepIndex = i;
				break;
			}
		}
	}

	return {
		ok: failedStepIndex === undefined,
		failedStepIndex,
		steps: results,
	};
}

async function executeInternal(
	step: PipelineStep,
	command: Command,
	bus?: EventBus,
) {
	await command.execute({
		rawArgs: step.argv, // Include command name to match main() behavior
		bus,
	});
}

async function executeExternal(step: PipelineStep, options: RunOptions) {
	const [file, ...args] = step.argv;
	if (!file) {
		throw new Error(`Empty external command in step: ${step.original}`);
	}

	const execOptions: Parameters<typeof execa>[2] = {
		cwd: options.cwd || process.cwd(),
		reject: true, // throw on error
	};

	if (options.captureOutput) {
		// Capture output for JSON/Machine results
		const result = await execa(file, args, execOptions);
		return { stdout: result.stdout, stderr: result.stderr };
	} else {
		// Inherit stdio for human interactive use
		await execa(file, args, { ...execOptions, stdio: "inherit" });
		return undefined;
	}
}
