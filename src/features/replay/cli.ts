import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";

export const replayMeta: AgentDocMeta = {
    name: "replay",
    description: "New feature: replay",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const replayHelp = `
Usage: nooa replay <input> [flags]

Describe what replay does.

Arguments:
  <input>     Input value.

Flags:
  --json      Output result as JSON.
  -h, --help  Show help message.

Examples:
  nooa replay hello
  nooa replay hello --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing input)
`;

export const replaySdkUsage = `
SDK Usage:
  const result = await replay.run({ input: "hello" });
  if (result.ok) {
    console.log(result.data.message);
  }
`;

export const replayUsage = {
    cli: "nooa replay <input> [--json]",
    sdk: "await replay.run({ input: \"hello\" })",
    tui: "ReplayDialog()",
};

export const replaySchema = {
    input: { type: "string", required: true },
    json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const replayOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "traceId", type: "string" },
    { name: "message", type: "string" },
];

export const replayErrors = [
    { code: "replay.missing_action", message: "Action is required." },
    { code: "replay.missing_input", message: "Input is required." },
    { code: "replay.runtime_error", message: "Unexpected error." },
];

export const replayExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "Runtime error" },
    { value: "2", description: "Validation error" },
];

export const replayExamples = [
    { input: "nooa replay hello", output: "Success output" },
    { input: "nooa replay hello --json", output: "{ ... }" },
];

export interface ReplayRunInput {
    action?: string;
    input?: string;
    json?: boolean;
}

export interface ReplayRunResult {
    ok: boolean;
    traceId: string;
    message: string;
}

export async function run(
    input: ReplayRunInput,
): Promise<SdkResult<ReplayRunResult>> {
    if (!input.action) {
        return {
            ok: false,
            error: sdkError("replay.missing_action", "Action is required."),
        };
    }
    if (!input.input) {
        return {
            ok: false,
            error: sdkError("replay.missing_input", "Input is required."),
        };
    }

    const traceId = createTraceId();
    return {
        ok: true,
        data: {
            ok: true,
            traceId,
            message: "Replay received: " + input.input,
        },
    };
}

const replayBuilder = new CommandBuilder<ReplayRunInput, ReplayRunResult>()
    .meta(replayMeta)
    .usage(replayUsage)
    .schema(replaySchema)
    .help(replayHelp)
    .sdkUsage(replaySdkUsage)
    .outputFields(replayOutputFields)
    .examples(replayExamples)
    .errors(replayErrors)
    .exitCodes(replayExitCodes)
    .options({ options: buildStandardOptions() })
    .parseInput(async ({ positionals, values }) => ({
        action: positionals[1],
        input: positionals[2],
        json: Boolean(values.json),
    }))
    .run(run)
    .onSuccess((output, values) => {
        if (values.json) {
            renderJson(output);
            return;
        }
        console.log(output.message);
    })
    .onFailure((error) => {
        handleCommandError(error, ["replay.missing_input"]);
    })
    .telemetry({
        eventPrefix: "replay",
        successMetadata: (input) => ({ input: input.input }),
        failureMetadata: (input, error) => ({ input: input.input, error: error.message }),
    });

export const replayAgentDoc = replayBuilder.buildAgentDoc(false);
export const replayFeatureDoc = (includeChangelog: boolean) =>
    replayBuilder.buildFeatureDoc(includeChangelog);

const replayCommand = replayBuilder.build();

export default replayCommand;
