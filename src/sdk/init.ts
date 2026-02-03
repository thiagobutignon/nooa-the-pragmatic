import { executeInit, type InitOptions } from "../features/init/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type InitRunInput = InitOptions;

export async function run(
	input: InitRunInput,
): Promise<SdkResult<Awaited<ReturnType<typeof executeInit>>>> {
	try {
		const result = await executeInit(input);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("init_error", "Init failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const init = {
	run,
};
