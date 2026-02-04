import { readFile } from "node:fs/promises";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";

export const readMeta: AgentDocMeta = {
    name: "read",
    description: "Read file contents",
    changelog: [
        { version: "1.2.0", changes: ["Added stdin support"] },
        { version: "1.1.0", changes: ["Added --json flag"] },
        { version: "1.0.0", changes: ["Initial release"] },
    ],
};

export const readHelp = `
Usage: nooa read <path> [flags]

Read file contents from the local filesystem.

Arguments:
  <path>      Path to the file to read.

Flags:
  --json              Output JSON with path, bytes, content.
  --include-changelog Include changelog in help output.
  -h, --help          Show help message.

Examples:
  nooa read README.md
  nooa read src/index.ts --json

Exit Codes:
  0: Success
  1: Runtime Error (file not found or read failed)
  2: Validation Error (missing path)

Error Codes:
  read.missing_path: Path required or invalid
  read.not_found: File not found
  read.read_failed: Read failed
`;

export const readSdkUsage = `
SDK Usage:
  const result = await read.run({ path: "file.txt", json: false });
  if (result.ok) {
    console.log(result.data.content);
  }
`;

export const readUsage = {
    cli: "nooa read <path> [--json]",
    sdk: "await read.run({ path: \"file.txt\", json: false })",
    tui: "ReadFileDialog({ initialPath })",
};

export const readSchema = {
    path: { type: "string", required: true },
    json: { type: "boolean", required: false, default: false, since: "1.1.0" },
} satisfies SchemaSpec;

export const readOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "traceId", type: "string" },
    { name: "path", type: "string" },
    { name: "bytes", type: "number" },
    { name: "content", type: "string" },
];

export const readExamples = [
    { input: "nooa read README.md", output: "File contents to stdout" },
    {
        input: "nooa read package.json --json",
        output: '{ "path": "package.json", "bytes": 1234, "content": "..." }',
    },
];

export const readErrors = [
    { code: "read.missing_path", message: "Path required or invalid" },
    { code: "read.not_found", message: "File not found" },
    { code: "read.read_failed", message: "Read failed" },
];

export const readExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "File not found or read failed" },
    { value: "2", description: "Path required or invalid" },
];


export interface ReadRunInput {
    path?: string;
    json?: boolean;
}

export interface ReadRunResult {
    ok: boolean;
    traceId: string;
    path: string;
    bytes: number;
    content: string;
}

export async function run(
	input: ReadRunInput,
): Promise<SdkResult<ReadRunResult>> {
	const traceId = createTraceId();
	const path = input.path;

	if (!path) {
		return {
			ok: false,
			error: sdkError("read.missing_path", "Path is required."),
		};
	}

	try {
		const content = await readFile(path, "utf-8");
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                path,
                bytes: Buffer.byteLength(content),
                content,
            },
        };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const isNotFound = message.toLowerCase().includes("no such file");
		return {
			ok: false,
			error: sdkError(isNotFound ? "read.not_found" : "read.read_failed", "Failed to read file.", {
				path,
				error: message,
			}),
		};
	}
}

const readBuilder = new CommandBuilder<ReadRunInput, ReadRunResult>()
    .meta(readMeta)
    .usage(readUsage)
    .schema(readSchema)
    .help(readHelp)
    .sdkUsage(readSdkUsage)
    .outputFields(readOutputFields)
    .examples(readExamples)
    .errors(readErrors)
    .exitCodes(readExitCodes)
    .options({ options: buildStandardOptions() })
    .parseInput(async ({ values, positionals }) => {
        const { getStdinText } = await import("../../core/io");
        let path = positionals[1];

        if (!path) {
            path = await getStdinText();
        }

        return {
            path,
            json: Boolean(values.json),
        };
    })
    .run(run)
	.onFailure((error, input) => {
		const errorMessage = error.details?.error
			? String(error.details.error)
			: error.message;
		if (errorMessage.toLowerCase().includes("no such file")) {
			console.error(`Error: File not found: ${input.path ?? ""}`);
		} else {
			console.error(`Error: ${error.message}`);
		}
		process.exitCode = error.code === "read.missing_path" ? 2 : 1;
	})
    .onSuccess((output, values) => {
        if (values.json) {
            console.log(JSON.stringify(output, null, 2));
            return;
        }
        process.stdout.write(output.content);
    })
    .telemetry({
        eventPrefix: "read",
        successMetadata: (_, output) => ({
            path: output.path,
            bytes: output.bytes,
        }),
        failureMetadata: (input, error) => ({
            path: input.path,
            error: error.message,
        }),
    });

export const readAgentDoc = readBuilder.buildAgentDoc(false);
export const readFeatureDoc = (includeChangelog: boolean) =>
    readBuilder.buildFeatureDoc(includeChangelog);

const readCommand = readBuilder.build();

export default readCommand;
