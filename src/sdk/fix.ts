import { executeFix } from "../features/fix/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface FixRunInput {
	issue?: string;
	dryRun?: boolean;
	json?: boolean;
}

export async function run(
	input: FixRunInput,
): Promise<SdkResult<Awaited<ReturnType<typeof executeFix>>>> {
	try {
		const result = await executeFix({
			issue: input.issue,
			dryRun: input.dryRun,
			json: input.json,
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("fix_error", "Fix execution failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const fix = {
	run,
};
