import { execa } from "execa";
import { CommandRegistry, loadCommands } from "../../core/registry";
import { logger } from "../../core/logger";
import type { PipelineResult, PipelineStep, RunOptions, StepResult } from "./types";
import { join } from "node:path";

export async function executePipeline(
    steps: PipelineStep[],
    options: RunOptions,
    bus: any, // EventBus
): Promise<PipelineResult> {
    const results: StepResult[] = [];
    let failedStepIndex: number | undefined;

    // Load registry for internal commands
    // We assume features dir is at ../../features relative to this file
    const featuresDir = join(__dirname, "../../../src/features");
    const registry = await loadCommands(featuresDir);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const startTime = Date.now();

        try {
            if (step.kind === "external") {
                // Explicit 'exec' prefix used in parser
                await executeExternal(step, options);
                results.push({
                    step,
                    exitCode: 0,
                    durationMs: Date.now() - startTime,
                });
            } else {
                // Internal or Implicit External
                const cmdName = step.argv[0];
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
                        await executeExternal(step, options);
                        results.push({
                            step,
                            exitCode: 0,
                            durationMs: Date.now() - startTime,
                        });
                    } else {
                        throw new Error(
                            `Unknown internal command: '${cmdName}'. To run external commands, use the 'exec' prefix or --allow-external flag.`,
                        );
                    }
                }
            }
        } catch (error: any) {
            const exitCode = error.exitCode ?? 1;
            results.push({
                step,
                exitCode,
                durationMs: Date.now() - startTime,
                error: error.message,
                stderr: error.stderr,
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
    command: any, // Command type
    bus: any,
) {
    await command.execute({
        rawArgs: step.argv.slice(1), // remove command name
        bus,
    });
}

async function executeExternal(step: PipelineStep, options: RunOptions) {
    const [file, ...args] = step.argv;
    await execa(file, args, {
        cwd: options.cwd || process.cwd(),
        stdio: "inherit",
        reject: true, // throw on error
    });
}
