import { useCallback, useState } from "react";
import { run as runCheck } from "../../features/check/cli";
import type { CheckRunInput, CheckRunResult } from "../../features/check/cli";
import type { SdkError } from "../../core/types";

export type CheckStatus = "idle" | "loading" | "success" | "error";

export interface UseCheckState {
	status: CheckStatus;
	data?: CheckRunResult;
	error?: SdkError;
}

export interface UseCheckResult {
	state: UseCheckState;
	run: (input: CheckRunInput) => Promise<void>;
	reset: () => void;
}

export function useCheck(): UseCheckResult {
	const [state, setState] = useState<UseCheckState>({ status: "idle" });

	const run = useCallback(async (input: CheckRunInput) => {
		setState({ status: "loading" });
		const result = await runCheck(input);
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
