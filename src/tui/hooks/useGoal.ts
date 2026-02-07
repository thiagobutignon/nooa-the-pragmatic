import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { GoalRunInput, GoalRunResult } from "../../features/goal/cli";
import { run as runGoal } from "../../features/goal/cli";

export type GoalStatus = "idle" | "loading" | "success" | "error";

export interface UseGoalState {
	status: GoalStatus;
	data?: GoalRunResult;
	error?: SdkError;
}

export interface UseGoalResult {
	state: UseGoalState;
	run: (input: GoalRunInput) => Promise<void>;
	reset: () => void;
}

export function useGoal(): UseGoalResult {
	const [state, setState] = useState<UseGoalState>({ status: "idle" });

	const run = useCallback(async (input: GoalRunInput) => {
		setState({ status: "loading" });
		const result = await runGoal(input);
		if (!result.ok) {
			setState({ status: "error", error: result.error });
			return;
		}
		setState({ status: "success", data: result.data });
	}, []);

	const reset = useCallback(() => {
		setState({ status: "idle" });
	}, []);

	return { state, run, reset };
}
