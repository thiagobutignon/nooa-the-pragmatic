import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	printError,
	renderJsonOrWrite,
	setExitCode
} from "../../core/cli-output";
import { buildStandardOptions } from "../../core/cli-flags";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { createTraceId } from "../../core/logger";
import { executeScaffold } from "./execute";

export const scaffoldMeta: AgentDocMeta = {
	name: "scaffold",
	description: "Standardize creation of new features and prompts",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const scaffoldHelp = `
Usage: nooa scaffold <command|prompt> <name> [flags]

Standardize creation of new features and prompts.

Arguments:
  <command|prompt>    Type of item to scaffold.
  <name>              Name of the item.

Flags:
  --dry-run      Log planned operations without writing to disk.
  --force        Allow overwriting existing files.
  --json         Output result as structured JSON.
  --out <file>   Write results report to a specific file.
  --with-docs    Generate documentation template.
  -h, --help     Show help message.

Examples:
  nooa scaffold command authentication
  nooa scaffold prompt review --with-docs

Exit Codes:
  0: Success
  1: Runtime Error (file IO failure)
  2: Validation Error (invalid arguments or name)

Error Codes:
  scaffold.invalid_args: Missing or invalid arguments
  scaffold.invalid_type: Type must be command or prompt
  scaffold.invalid_name: Name must be kebab-case and not reserved
  scaffold.already_exists: Destination file exists
  scaffold.runtime_error: Unexpected error
`;

export const scaffoldSdkUsage = `
SDK Usage:
  await scaffold.run({ type: "command", name: "my-feature", dryRun: true });
  await scaffold.run({ type: "prompt", name: "review", withDocs: true });
`;

export const scaffoldUsage = {
	cli: "nooa scaffold <command|prompt> <name> [flags]",
	sdk: "await scaffold.run({ type: \"command\", name: \"my-feature\" })",
	tui: "ScaffoldWizard()",
};

export const scaffoldSchema = {
	type: { type: "string", required: true },
	name: { type: "string", required: true },
	force: { type: "boolean", required: false },
	"dry-run": { type: "boolean", required: false },
	"with-docs": { type: "boolean", required: false },
	json: { type: "boolean", required: false },
	out: { type: "string", required: false },
} satisfies SchemaSpec;

export const scaffoldOutputFields = [
	{ name: "ok", type: "boolean" },
	{ name: "traceId", type: "string" },
	{ name: "kind", type: "string" },
	{ name: "name", type: "string" },
	{ name: "files", type: "string" },
	{ name: "dryRun", type: "boolean" },
];

export const scaffoldErrors = [
	{ code: "scaffold.invalid_args", message: "Missing or invalid arguments." },
	{
		code: "scaffold.invalid_type",
		message: "Type must be command or prompt.",
	},
	{
		code: "scaffold.invalid_name",
		message: "Name must be kebab-case and not reserved.",
	},
	{ code: "scaffold.already_exists", message: "Destination file exists." },
	{ code: "scaffold.runtime_error", message: "Unexpected error." },
];

export const scaffoldExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const scaffoldExamples = [
	{ input: "nooa scaffold command authentication", output: "Creates a feature" },
	{
		input: "nooa scaffold prompt review --with-docs",
		output: "Creates a prompt template",
	},
];

export type ScaffoldKind = "command" | "prompt";

export interface ScaffoldRunInput {
	type?: ScaffoldKind;
	name?: string;
	force?: boolean;
	dryRun?: boolean;
	withDocs?: boolean;
	json?: boolean;
	out?: string;
}

export interface ScaffoldRunResult {
	ok: boolean;
	traceId: string;
	kind: ScaffoldKind;
	name: string;
	files: string[];
	dryRun: boolean;
}

function isValidationMessage(message: string) {
	return (
		message.includes("Invalid name") ||
		message.includes("reserved word") ||
		message.includes("already exists")
	);
}

export async function run(
	input: ScaffoldRunInput,
): Promise<SdkResult<ScaffoldRunResult>> {
	if (!input.type || !input.name) {
		const traceId = createTraceId();
		return {
			ok: false,
			error: sdkError(
				"scaffold.invalid_args",
				"Missing or invalid arguments.",
				{ traceId },
			),
		};
	}

	if (input.type !== "command" && input.type !== "prompt") {
		const traceId = createTraceId();
		return {
			ok: false,
			error: sdkError("scaffold.invalid_type", "Type must be command or prompt.", {
				traceId,
			}),
		};
	}

	try {
		const { results, traceId } = await executeScaffold({
			type: input.type,
			name: input.name,
			force: input.force,
			dryRun: input.dryRun,
			withDocs: input.withDocs,
		});

		return {
			ok: true,
			data: {
				ok: true,
				traceId,
				kind: input.type,
				name: input.name,
				files: results,
				dryRun: Boolean(input.dryRun),
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const traceId = createTraceId();
		if (message.includes("already exists")) {
			return {
				ok: false,
				error: sdkError("scaffold.already_exists", message, { traceId }),
			};
		}
		if (message.includes("Invalid name") || message.includes("reserved word")) {
			return {
				ok: false,
				error: sdkError("scaffold.invalid_name", message, { traceId }),
			};
		}
		return {
			ok: false,
			error: sdkError(
				isValidationMessage(message)
					? "scaffold.invalid_name"
					: "scaffold.runtime_error",
				message,
				{ traceId },
			),
		};
	}
}

const scaffoldBuilder = new CommandBuilder<ScaffoldRunInput, ScaffoldRunResult>()
	.meta(scaffoldMeta)
	.usage(scaffoldUsage)
	.schema(scaffoldSchema)
	.help(scaffoldHelp)
	.sdkUsage(scaffoldSdkUsage)
	.outputFields(scaffoldOutputFields)
	.examples(scaffoldExamples)
	.errors(scaffoldErrors)
	.exitCodes(scaffoldExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			"dry-run": { type: "boolean" },
			force: { type: "boolean" },
			out: { type: "string" },
			"with-docs": { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => ({
		type: positionals[1] as ScaffoldKind | undefined,
		name: positionals[2],
		force: Boolean(values.force),
		dryRun: Boolean(values["dry-run"]),
		withDocs: Boolean(values["with-docs"]),
		json: Boolean(values.json),
		out: typeof values.out === "string" ? values.out : undefined,
	}))
	.run(run)
	.onSuccess(async (output, values) => {
		const jsonMode = Boolean(values.json);
		if (jsonMode) {
			const payload = {
				schemaVersion: "1.0",
				ok: true,
				traceId: output.traceId,
				command: "scaffold",
				timestamp: new Date().toISOString(),
				kind: output.kind,
				name: output.name,
				files: output.files,
				dryRun: output.dryRun,
			};

			await renderJsonOrWrite(
				payload,
				typeof values.out === "string" ? values.out : undefined,
			);
			return;
		}

		console.log(`\n✅ Scaffold success (${output.traceId})`);
		if (output.dryRun) {
			console.log("[DRY RUN CALLBACK] No files were actually written.");
		}
		console.log(`Created ${output.kind}: ${output.name}`);
		output.files.forEach((file) => {
			console.log(`  - ${file}`);
		});

		if (!output.dryRun) {
			console.log("\nNext Steps:");
			if (output.kind === "command") {
				console.log(`  1. Run tests: bun test src/features/${output.name}`);
				console.log(`  2. Check help: bun index.ts ${output.name} --help`);
			} else {
				console.log(
					`  1. Validate prompt: bun index.ts prompt validate ${output.name}`,
				);
			}
		}
	})
	.onFailure(async (error, input) => {
		if (input.json) {
			const payload = {
				schemaVersion: "1.0",
				ok: false,
				traceId:
					typeof error.details?.traceId === "string"
						? error.details.traceId
						: undefined,
				command: "scaffold",
				timestamp: new Date().toISOString(),
				error: error.message,
			};
			await renderJsonOrWrite(payload, input.out ?? undefined);
			setExitCode(error, [
				"scaffold.invalid_args",
				"scaffold.invalid_type",
				"scaffold.invalid_name",
				"scaffold.already_exists",
			]);
			return;
		}
		if (error.code.startsWith("scaffold.")) {
			const label = error.code.includes("invalid")
				? "Validation Error"
				: error.code.includes("already_exists")
					? "Validation Error"
					: "Runtime Error";
			console.error(`❌ ${label}: ${error.message}`);
		} else {
			printError(error);
		}
		setExitCode(error, [
			"scaffold.invalid_args",
			"scaffold.invalid_type",
			"scaffold.invalid_name",
			"scaffold.already_exists",
		]);
	})
	.telemetry({
		eventPrefix: "scaffold",
		successMetadata: (input, output) => ({
			name: output.name,
			kind: output.kind,
			files_written: output.dryRun ? 0 : output.files.length,
			dry_run: output.dryRun,
			with_docs: Boolean(input.withDocs),
		}),
		failureMetadata: (input, error) => ({
			name: input.name,
			kind: input.type,
			error: error.message,
		}),
	});

export const scaffoldAgentDoc = scaffoldBuilder.buildAgentDoc(false);
export const scaffoldFeatureDoc = (includeChangelog: boolean) =>
	scaffoldBuilder.buildFeatureDoc(includeChangelog);

const scaffoldCommand = scaffoldBuilder.build();

export default scaffoldCommand;
