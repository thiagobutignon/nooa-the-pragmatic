import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError } from "../../core/cli-output";
import type { EventBus } from "../../core/event-bus";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { checkGate, type GateCheckResult } from "./execute";

export const gateMeta: AgentDocMeta = {
    name: "gate",
    description: "Verify project state against defined quality gates.",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const gateHelp = `
Usage: nooa gate <subcommand> [flags]

Verify project state against defined quality gates.

Subcommands:
  check      Run a specific gate check.

Flags:
  --id <name>        Gate ID to check (spec, test, dogfood).
  --target <target>  Target for dogfood check (e.g. command name).
  --json             Output result as JSON.
  -h, --help         Show help message.

Examples:
  nooa gate check --id spec
  nooa gate check --id dogfood --target replay
`;

export const gateSdkUsage = `
SDK Usage:
  import { checkGate } from "./execute";
  const result = await checkGate({ id: "spec" });
`;

export const gateUsage = {
    cli: "nooa gate <subcommand> [flags]",
    sdk: "await checkGate({ id: \"spec\" })",
};

export const gateSchema = {
    action: { type: "string", required: false },
    id: { type: "string", required: false },
    target: { type: "string", required: false },
    json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const gateOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "reason", type: "string" },
    { name: "gateId", type: "string" },
];

export const gateErrors = [
    { code: "gate.missing_id", message: "Gate ID is required." },
    { code: "gate.unknown_gate", message: "Unknown gate ID." },
];

export const gateExitCodes = [
    { value: "0", description: "Success (Gate Passed)" },
    { value: "1", description: "Gate Failed" },
];

export const gateExamples = [
    { input: "nooa gate check --id spec", output: "Check if the project meets the defined specifications." },
    { input: "nooa gate check --id dogfood --target replay", output: "Run dogfooding check on the 'replay' command." },
];

export interface GateRunInput {
    action?: "check";
    id?: string;
    target?: string;
    json?: boolean;
    bus?: EventBus;
    traceId?: string;
}

export async function run(input: GateRunInput): Promise<SdkResult<GateCheckResult>> {
    if (input.action !== "check") {
        return {
            ok: true,
            data: { ok: true, gateId: "help", reason: gateHelp } as any
        };
    }

    if (!input.id) {
        return {
            ok: false,
            error: sdkError("gate.missing_id", "Gate ID is required (--id)."),
        };
    }

    return checkGate({
        id: input.id,
        target: input.target,
        bus: input.bus,
        traceId: input.traceId,
    });
}

const gateBuilder = new CommandBuilder<GateRunInput, GateCheckResult>()
    .meta(gateMeta)
    .usage(gateUsage)
    .schema(gateSchema)
    .help(gateHelp)
    .sdkUsage(gateSdkUsage)
    .outputFields(gateOutputFields)
    .examples(gateExamples)
    .errors(gateErrors)
    .exitCodes(gateExitCodes)
    .options({
        options: {
            ...buildStandardOptions(),
            id: { type: "string" },
            target: { type: "string" },
        },
    })
    .parseInput(async ({ positionals, values, bus, traceId }) => {
        const action = positionals[1] === "check" ? "check" : undefined;
        return {
            action,
            id: typeof values.id === "string" ? values.id : undefined,
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

        if (output.gateId === "help") {
            console.log(output.reason);
            return;
        }

        if (output.ok) {
            console.error(`✅ Gate '${output.gateId}' passed.`);
        } else {
            console.error(`❌ Gate '${output.gateId}' failed.`);
            if (output.reason) console.error(`Reason: ${output.reason}`);
            if (output.suggestions?.length) {
                console.error("Suggestions:");
                output.suggestions.forEach(s => console.error(`  - ${s}`));
            }
            process.exitCode = 1;
        }
    })
    .onFailure((error) => {
        handleCommandError(error, ["gate.missing_id", "gate.unknown_gate"]);
    });

export default gateBuilder.build();
