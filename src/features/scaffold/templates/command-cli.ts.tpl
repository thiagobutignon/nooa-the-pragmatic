import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";

export const {{camelName}}Meta: AgentDocMeta = {
    name: "{{name}}",
    description: "New feature: {{name}}",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const {{camelName}}Help = `
Usage: nooa {{name}} <input> [flags]

Describe what {{name}} does.

Arguments:
  <input>     Input value.

Flags:
  --json      Output result as JSON.
  -h, --help  Show help message.

Examples:
  nooa {{name}} hello
  nooa {{name}} hello --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing input)
`;

export const {{camelName}}SdkUsage = `
SDK Usage:
  const result = await {{name}}.run({ input: "hello" });
  if (result.ok) {
    console.log(result.data.message);
  }
`;

export const {{camelName}}Usage = {
    cli: "nooa {{name}} <input> [--json]",
    sdk: "await {{name}}.run({ input: \"hello\" })",
    tui: "{{Command}}Dialog()",
};

export const {{camelName}}Schema = {
    input: { type: "string", required: true },
    json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const {{camelName}}OutputFields = [
    { name: "ok", type: "boolean" },
    { name: "traceId", type: "string" },
    { name: "message", type: "string" },
];

export const {{camelName}}Errors = [
    { code: "{{name}}.missing_input", message: "Input is required." },
    { code: "{{name}}.runtime_error", message: "Unexpected error." },
];

export const {{camelName}}ExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "Runtime error" },
    { value: "2", description: "Validation error" },
];

export const {{camelName}}Examples = [
    { input: "nooa {{name}} hello", output: "Success output" },
    { input: "nooa {{name}} hello --json", output: "{ ... }" },
];

export interface {{Command}}RunInput {
    input?: string;
    json?: boolean;
}

export interface {{Command}}RunResult {
    ok: boolean;
    traceId: string;
    message: string;
}

export async function run(
    input: {{Command}}RunInput,
): Promise<SdkResult<{{Command}}RunResult>> {
    if (!input.input) {
        return {
            ok: false,
            error: sdkError("{{name}}.missing_input", "Input is required."),
        };
    }

    const traceId = createTraceId();
    return {
        ok: true,
        data: {
            ok: true,
            traceId,
            message: "{{Command}} received: " + input.input,
        },
    };
}

const {{camelName}}Builder = new CommandBuilder<{{Command}}RunInput, {{Command}}RunResult>()
    .meta({{camelName}}Meta)
    .usage({{camelName}}Usage)
    .schema({{camelName}}Schema)
    .help({{camelName}}Help)
    .sdkUsage({{camelName}}SdkUsage)
    .outputFields({{camelName}}OutputFields)
    .examples({{camelName}}Examples)
    .errors({{camelName}}Errors)
    .exitCodes({{camelName}}ExitCodes)
    .options({ options: buildStandardOptions() })
    .parseInput(async ({ positionals, values }) => ({
        input: positionals[1],
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
        handleCommandError(error, ["{{name}}.missing_input"]);
    })
    .telemetry({
        eventPrefix: "{{name}}",
        successMetadata: (input) => ({ input: input.input }),
        failureMetadata: (input, error) => ({ input: input.input, error: error.message }),
    });

export const {{camelName}}AgentDoc = {{camelName}}Builder.buildAgentDoc(false);
export const {{camelName}}FeatureDoc = (includeChangelog: boolean) =>
    {{camelName}}Builder.buildFeatureDoc(includeChangelog);

const {{camelName}}Command = {{camelName}}Builder.build();

export default {{camelName}}Command;
