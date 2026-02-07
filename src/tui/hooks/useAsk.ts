import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { AskRunInput, AskRunResult } from "../../features/ask/cli";
import { run as runAsk } from "../../features/ask/cli";

export type AskStatus = "idle" | "loading" | "success" | "error";

export interface UseAskState {
	status: AskStatus;
	data?: AskRunResult;
	error?: SdkError;
}

export interface UseAskResult {
	state: UseAskState;
	run: (input: AskRunInput) => Promise<void>;
	reset: () => void;
}

export function useAsk(): UseAskResult {
	const [state, setState] = useState<UseAskState>({ status: "idle" });

	const run = useCallback(async (input: AskRunInput) => {
		setState({ status: "loading" });
		const result = await runAsk(input);
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
