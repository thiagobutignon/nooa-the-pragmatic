import { executeCi } from "../features/ci/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type CiRunInput = {
	json?: boolean;
};

export async function run(input: CiRunInput = {}): Promise<SdkResult<Awaited<ReturnType<typeof executeCi>>>> {
	try {
		const result = await executeCi({ json: input.json });
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("ci_error", "CI execution failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const ci = {
	run,
};
