import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import type { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { createTraceId } from "../../core/logger";
import { WorkflowEngine } from "../../core/workflow/Engine";
import { DogfoodGate } from "../../core/workflow/gates/DogfoodGate";
import { SpecGate } from "../../core/workflow/gates/SpecGate";
import { TestGate } from "../../core/workflow/gates/TestGate";
import type { Gate, WorkflowContext, WorkflowStep } from "../../core/workflow/types";
import { ActEngine } from "./engine";

export const actMeta: AgentDocMeta = {
    name: "act",
    description: "Autonomous agent orchestrator",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const actHelp = `
Usage: nooa act <goal> [flags]

Orchestrate multiple commands to achieve a high-level goal.
The agent perceives capabilities via self-describing modules (AgentDocs).

Arguments:
  <goal>         The objective to achieve (e.g. "Check code and fix lint errors").

Flags:
  --model <name>      LLM model to use (default: configured in env).
  --provider <name>   LLM provider (default: ollama).
  --turns <number>    Max turns (default: 10).
  --json              Output result as JSON.
  -h, --help          Show help message.

Examples:
  nooa act "Get the title of README.md"
  nooa act "Run CI and summarize failures" --model gpt-4

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  act.missing_goal: Goal is required
  act.max_turns_exceeded: Goal not achieved within turn limit
  act.runtime_error: Execution failed
`;

export const actSdkUsage = `
SDK Usage:
  const result = await act.run({ goal: "Fix bugs" });
  if (result.ok) console.log(result.data.finalAnswer);
`;

export const actUsage = {
    cli: "nooa act <goal> [flags]",
    sdk: "await act.run({ goal: \"Fix bugs\" })",
    tui: "ActConsole()",
};

export const actSchema = {
    goal: { type: "string", required: true },
    model: { type: "string", required: false },
    provider: { type: "string", required: false },
    turns: { type: "number", required: false },
    json: { type: "boolean", required: false },
    "skip-verification": { type: "boolean", required: false },
} satisfies SchemaSpec;

export const actOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "history", type: "string" },
    { name: "finalAnswer", type: "string" },
];

export const actErrors = [
    { code: "act.missing_goal", message: "Goal is required." },
    {
        code: "act.max_turns_exceeded",
        message: "Goal not achieved within turn limit.",
    },
    { code: "act.runtime_error", message: "Execution failed." },
];

export const actExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "Runtime Error" },
    { value: "2", description: "Validation Error" },
];

export const actExamples = [
    { input: "nooa act 'Check status'", output: "Check the status of the project using the autonomous agent." },
    { input: "nooa act 'Run CI and fix errors'", output: "Run CI and automatically fix any errors found." },
];

export interface ActRunInput {
    goal?: string;
    model?: string;
    provider?: string;
    turns?: number;
    json?: boolean;
    bus?: EventBus;
    traceId?: string;
    skipVerification?: boolean;
}

export interface ActRunResult {
    ok: boolean;
    history: Array<{ role: string; content: string }>;
    finalAnswer: string;
}

export async function run(
    input: ActRunInput,
): Promise<SdkResult<ActRunResult>> {
    if (!input.goal) {
        return {
            ok: false,
            error: sdkError("act.missing_goal", "Goal is required."),
        };
    }

    try {
        const traceId = createTraceId();
        const ctx: WorkflowContext = {
            traceId,
            command: "act",
            args: { goal: input.goal },
            cwd: process.cwd(),
        };

        const bus = input.bus;
        bus?.emit("workflow.started", {
            type: "workflow.started",
            traceId,
            goal: input.goal,
        });

        const wrapGate = (stepId: string, gate: Gate): Gate => ({
            id: gate.id,
            description: gate.description,
            check: async (gateCtx: WorkflowContext) => {
                bus?.emit("workflow.step.start", {
                    type: "workflow.step.start",
                    traceId,
                    stepId,
                });
                const result = await gate.check(gateCtx);
                if (result.ok) {
                    bus?.emit("workflow.gate.pass", {
                        type: "workflow.gate.pass",
                        traceId,
                        gateId: gate.id,
                    });
                } else {
                    bus?.emit("workflow.gate.fail", {
                        type: "workflow.gate.fail",
                        traceId,
                        gateId: gate.id,
                        reason: result.reason,
                    });
                }
                return result;
            },
        });

        const steps: WorkflowStep[] = input.skipVerification
            ? []
            : [
                { id: "spec", gate: wrapGate("spec", new SpecGate()), action: async () => { } },
                { id: "tests", gate: wrapGate("tests", new TestGate()), action: async () => { } },
                { id: "dogfood", gate: wrapGate("dogfood", new DogfoodGate()), action: async () => { } },
            ];

        const workflow = new WorkflowEngine();
        const workflowResult = await workflow.run(steps, ctx);
        if (!workflowResult.ok) {
            bus?.emit("workflow.completed", {
                type: "workflow.completed",
                traceId,
                result: "failure",
            });
            return {
                ok: false,
                error: sdkError(
                    "act.runtime_error",
                    workflowResult.reason ?? "Workflow failed.",
                ),
            };
        }

        bus?.emit("workflow.completed", {
            type: "workflow.completed",
            traceId,
            result: "success",
        });

        const engine = new ActEngine();
        const result = await engine.execute(input.goal, {
            model: input.model,
            provider: input.provider,
            maxTurns: input.turns,
            skipVerification: input.skipVerification,
            bus: input.bus,
        });

        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            ok: false,
            error: sdkError("act.runtime_error", message),
        };
    }
}

const actBuilder = new CommandBuilder<ActRunInput, ActRunResult>()
    .meta(actMeta)
    .usage(actUsage)
    .schema(actSchema)
    .help(actHelp)
    .sdkUsage(actSdkUsage)
    .outputFields(actOutputFields)
    .examples(actExamples)
    .errors(actErrors)
    .exitCodes(actExitCodes)
    .options({
        options: {
            ...buildStandardOptions(),
            model: { type: "string" },
            provider: { type: "string" },
            turns: { type: "string" },
            "skip-verification": { type: "boolean" },
        },
    })
    .parseInput(async ({ positionals, values, bus, traceId }) => {
        const turnsRaw = typeof values.turns === "string" ? values.turns : undefined;
        const turnsParsed = turnsRaw ? Number.parseInt(turnsRaw, 10) : undefined;
        const goal = positionals[1];
        // act.started is emitted by ActEngine now
        /*
        if (bus && traceId) {
            bus.emit("act.started", {
                type: "act.started",
                traceId,
                goal: goal ?? "",
            });
        }
        */
        return {
            goal,
            model: typeof values.model === "string" ? values.model : undefined,
            provider: typeof values.provider === "string" ? values.provider : undefined,
            turns: Number.isNaN(turnsParsed) ? undefined : turnsParsed,
            json: Boolean(values.json),
            bus,
            traceId,
            skipVerification: Boolean(values["skip-verification"]),
        };
    })
    .run(run)
    .onSuccess((output, values, input) => {
        if (values.json) {
            console.log(JSON.stringify(output));
            input.bus?.emit("act.completed", {
                type: "act.completed",
                traceId: input.traceId ?? "",
                goal: input.goal ?? "",
                result: "success",
            });
            return;
        }
        console.log(`\n🏁 Result: ${output.finalAnswer}`);
        input.bus?.emit("act.completed", {
            type: "act.completed",
            traceId: input.traceId ?? "",
            goal: input.goal ?? "",
            result: "success",
        });
    })
    .onFailure((error, input) => {
        handleCommandError(error, ["act.missing_goal", "act.max_turns_exceeded"]);
        input.bus?.emit("act.failed", {
            type: "act.failed",
            traceId: input.traceId ?? "",
            goal: input.goal ?? "",
            error: error.message,
        });
    })
    .telemetry({
        eventPrefix: "act",
        successMetadata: (_, output) => ({
            turns: output.history.length,
        }),
        failureMetadata: (input, error) => ({
            goal: input.goal,
            error: error.message,
        }),
    });

export const actAgentDoc = actBuilder.buildAgentDoc(false);
export const actFeatureDoc = (includeChangelog: boolean) =>
    actBuilder.buildFeatureDoc(includeChangelog);

const actCommand = actBuilder.build();

export default actCommand;
