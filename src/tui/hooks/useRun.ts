import { useCallback, useState } from "react";
import { run as runPipeline } from "../../features/run/cli";
import type { RunRunInput, RunRunResult } from "../../features/run/cli";
import type { SdkError } from "../../core/types";

export type RunStatus = "idle" | "loading" | "success" | "error";

export interface UseRunState {
	status: RunStatus;
	data?: RunRunResult;
	error?: SdkError;
}

export interface UseRunResult {
	state: UseRunState;
	run: (input: RunRunInput) => Promise<void>;
	reset: () => void;
}

export function useRun(): UseRunResult {
	const [state, setState] = useState<UseRunState>({ status: "idle" });

	const run = useCallback(async (input: RunRunInput) => {
		setState({ status: "loading" });
		const result = await runPipeline(input);
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
