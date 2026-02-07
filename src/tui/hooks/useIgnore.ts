import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	IgnoreRunInput,
	IgnoreRunResult,
} from "../../features/ignore/cli";
import { run as runIgnore } from "../../features/ignore/cli";

export type IgnoreStatus = "idle" | "loading" | "success" | "error";

export interface UseIgnoreState {
	status: IgnoreStatus;
	data?: IgnoreRunResult;
	error?: SdkError;
}

export interface UseIgnoreResult {
	state: UseIgnoreState;
	run: (input: IgnoreRunInput) => Promise<void>;
	reset: () => void;
}

export function useIgnore(): UseIgnoreResult {
	const [state, setState] = useState<UseIgnoreState>({ status: "idle" });

	const run = useCallback(async (input: IgnoreRunInput) => {
		setState({ status: "loading" });
		const result = await runIgnore(input);
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
