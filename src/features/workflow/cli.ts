import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError } from "../../core/cli-output";
import type { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { runWorkflow, type WorkflowRunResult } from "./execute";

export const workflowMeta: AgentDocMeta = {
    name: "workflow",
    description: "Run a verification workflow sequence.",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const workflowHelp = `
Usage: nooa workflow run [flags]

Run a verification workflow sequence (series of gates).

Flags:
  --gates <list>     Comma-separated list of gates to run (default: spec,test,dogfood).
  --target <target>  Target for context (e.g. for dogfood gate).
  --json             Output result as JSON.
  -h, --help         Show help message.

Examples:
  nooa workflow run
  nooa workflow run --gates spec
  nooa workflow run --gates spec,test --target my-command
`;

export const workflowExamples = [
    { input: "nooa workflow run", output: "Run the full verification workflow (spec, test, dogfood)." },
    { input: "nooa workflow run --gates spec,test", output: "Run only the 'spec' and 'test' gates." },
];

export const workflowSdkUsage = `
SDK Usage:
import { runWorkflow } from "./execute";
const result = await runWorkflow({ gates: ["spec", "test"] });
`;

export const workflowUsage = {
    cli: "nooa workflow run [flags]",
    sdk: "await runWorkflow({ gates: [\"spec\"] })",
};

export const workflowSchema = {
    action: { type: "string", required: false },
    gates: { type: "string", required: false },
    target: { type: "string", required: false },
    json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const workflowOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "reason", type: "string" },
    { name: "failedStepId", type: "string" },
];

export const workflowErrors = [
    { code: "workflow.run_failed", message: "Workflow run failed." },
    { code: "workflow.unknown_gate", message: "Unknown gate ID." },
];

export const workflowExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "Failure" },
];

export interface WorkflowRunCliInput {
    action?: "run";
    gates?: string;
    target?: string;
    json?: boolean;
    bus?: EventBus;
    traceId?: string;
}

export async function run(input: WorkflowRunCliInput): Promise<SdkResult<WorkflowRunResult>> {
    if (input.action !== "run") {
        return {
            ok: true,
            data: { ok: true, failedStepId: "help", reason: workflowHelp } as any
        };
    }

    const gateList = input.gates ? input.gates.split(",").map(s => s.trim()) : undefined;

    return runWorkflow({
        gates: gateList,
        target: input.target,
        bus: input.bus,
        traceId: input.traceId,
    });
}

const workflowBuilder = new CommandBuilder<WorkflowRunCliInput, WorkflowRunResult>()
    .meta(workflowMeta)
    .usage(workflowUsage)
    .schema(workflowSchema)
    .help(workflowHelp)
    .sdkUsage(workflowSdkUsage)
    .outputFields(workflowOutputFields)
    .examples(workflowExamples)
    .errors(workflowErrors)
    .exitCodes(workflowExitCodes)
    .options({
        options: {
            ...buildStandardOptions(),
            gates: { type: "string" },
            target: { type: "string" },
        },
    })
    .parseInput(async ({ positionals, values, bus, traceId }) => {
        const action = positionals[1] === "run" ? "run" : undefined;
        return {
            action,
            gates: typeof values.gates === "string" ? values.gates : undefined,
            target: typeof values.target === "string" ? values.target : undefined,
            json: Boolean(values.json),
            bus,
            traceId,
        };
    })
    .run(run)
    .onSuccess((output, values) => {
        if (values.json) {
            console.log(JSON.stringify(output));
            return;
        }

        if (output.failedStepId === "help") {
            console.log(output.reason);
            return;
        }

        if (output.ok) {
            console.error("✅ Workflow passed.");
        } else {
            console.error(`❌ Workflow failed at step: ${output.failedStepId} `);
            if (output.reason) console.error(`Reason: ${output.reason} `);
            process.exitCode = 1;
        }
    })
    .onFailure((error) => {
        handleCommandError(error, ["workflow.unknown_gate"]);
    });

export default workflowBuilder.build();
