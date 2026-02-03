import { clearGoal, getGoal, setGoal } from "../features/goal/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface GoalSetInput {
	goal?: string;
	cwd?: string;
}

export interface GoalGetInput {
	cwd?: string;
}

export async function set(input: GoalSetInput): Promise<SdkResult<null>> {
	if (!input.goal) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Goal is required.", {
				field: "goal",
			}),
		};
	}
	try {
		await setGoal(input.goal, input.cwd);
		return { ok: true, data: null };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("goal_error", "Failed to set goal.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function get(input: GoalGetInput = {}): Promise<SdkResult<string | null>> {
	try {
		const result = await getGoal(input.cwd);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("goal_error", "Failed to get goal.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function clear(input: GoalGetInput = {}): Promise<SdkResult<null>> {
	try {
		await clearGoal(input.cwd);
		return { ok: true, data: null };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("goal_error", "Failed to clear goal.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const goal = {
	set,
	get,
	clear,
};
