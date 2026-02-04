import { useCallback, useState } from "react";
import { run as runEval } from "../../features/eval/cli";
import type { EvalRunInput, EvalRunResult } from "../../features/eval/cli";
import type { SdkError } from "../../core/types";

export type EvalStatus = "idle" | "loading" | "success" | "error";

export interface UseEvalState {
	status: EvalStatus;
	data?: EvalRunResult;
	error?: SdkError;
}

export interface UseEvalResult {
	state: UseEvalState;
	run: (input: EvalRunInput) => Promise<void>;
	reset: () => void;
}

export function useEval(): UseEvalResult {
	const [state, setState] = useState<UseEvalState>({ status: "idle" });

	const run = useCallback(async (input: EvalRunInput) => {
		setState({ status: "loading" });
		const result = await runEval(input);
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
