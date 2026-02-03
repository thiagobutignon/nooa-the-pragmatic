import { executeScaffold } from "../features/scaffold/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type ScaffoldKind = "command" | "prompt";

export interface ScaffoldRunInput {
	type?: ScaffoldKind;
	name?: string;
	force?: boolean;
	dryRun?: boolean;
	withDocs?: boolean;
	cwd?: string;
}

export interface ScaffoldRunResult {
	ok: boolean;
	traceId: string;
	kind: ScaffoldKind;
	name: string;
	files: string[];
	dryRun: boolean;
}

export async function run(
	input: ScaffoldRunInput,
): Promise<SdkResult<ScaffoldRunResult>> {
	if (!input.type || !input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "type and name are required.", {
				fields: [!input.type ? "type" : null, !input.name ? "name" : null].filter(Boolean),
			}),
		};
	}

	if (input.type !== "command" && input.type !== "prompt") {
		return {
			ok: false,
			error: sdkError("invalid_input", "type must be command or prompt.", {
				field: "type",
			}),
		};
	}

	const prevCwd = process.cwd();
	if (input.cwd) process.chdir(input.cwd);
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
				dryRun: !!input.dryRun,
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const isValidationError =
			message.includes("Invalid name") || message.includes("already exists");
		return {
			ok: false,
			error: sdkError(
				isValidationError ? "validation_error" : "runtime_error",
				"Scaffold failed.",
				{ message },
			),
		};
	} finally {
		if (input.cwd) process.chdir(prevCwd);
	}
}

export const scaffold = {
	run,
};
