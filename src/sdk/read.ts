import { readFile } from "node:fs/promises";
import { createTraceId } from "../core/logger";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface ReadRunInput {
	path?: string;
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
			error: sdkError("invalid_input", "Path is required."),
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
		return {
			ok: false,
			error: sdkError("runtime_error", "Failed to read file.", {
				path,
				error: message,
			}),
		};
	}
}

export const read = {
	run,
};
