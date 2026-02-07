import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { FixRunInput, FixRunResult } from "../../features/fix/cli";
import { run as runFix } from "../../features/fix/cli";

export type FixStatus = "idle" | "loading" | "success" | "error";

export interface UseFixState {
	status: FixStatus;
	data?: FixRunResult;
	error?: SdkError;
}

export interface UseFixResult {
	state: UseFixState;
	run: (input: FixRunInput) => Promise<void>;
	reset: () => void;
}

export function useFix(): UseFixResult {
	const [state, setState] = useState<UseFixState>({ status: "idle" });

	const run = useCallback(async (input: FixRunInput) => {
		setState({ status: "loading" });
		const result = await runFix(input);
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
