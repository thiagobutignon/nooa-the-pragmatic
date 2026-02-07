import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { InitRunInput, InitRunResult } from "../../features/init/cli";
import { run as runInit } from "../../features/init/cli";

export type InitStatus = "idle" | "loading" | "success" | "error";

export interface UseInitState {
	status: InitStatus;
	data?: InitRunResult;
	error?: SdkError;
}

export interface UseInitResult {
	state: UseInitState;
	run: (input: InitRunInput) => Promise<void>;
	reset: () => void;
}

export function useInit(): UseInitResult {
	const [state, setState] = useState<UseInitState>({ status: "idle" });

	const run = useCallback(async (input: InitRunInput) => {
		setState({ status: "loading" });
		const result = await runInit(input);
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
