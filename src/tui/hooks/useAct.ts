import { useCallback, useState } from "react";
import { run as runAct } from "../../features/act/cli";
import type { ActRunInput, ActRunResult } from "../../features/act/cli";
import type { SdkError } from "../../core/types";

export type ActStatus = "idle" | "loading" | "success" | "error";

export interface UseActState {
	status: ActStatus;
	data?: ActRunResult;
	error?: SdkError;
}

export interface UseActResult {
	state: UseActState;
	run: (input: ActRunInput) => Promise<void>;
	reset: () => void;
}

export function useAct(): UseActResult {
	const [state, setState] = useState<UseActState>({ status: "idle" });

	const run = useCallback(async (input: ActRunInput) => {
		setState({ status: "loading" });
		const result = await runAct(input);
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
