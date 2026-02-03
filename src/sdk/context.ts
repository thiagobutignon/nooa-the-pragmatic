import { buildContext } from "../features/context/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface ContextBuildInput {
	target?: string;
}

export async function build(
	input: ContextBuildInput,
): Promise<SdkResult<Awaited<ReturnType<typeof buildContext>>>> {
	if (!input.target) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Target is required.", {
				field: "target",
			}),
		};
	}

	try {
		const result = await buildContext(input.target);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("context_error", "Context build failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const context = {
	build,
};
