import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	ContextRunInput,
	ContextRunResult,
} from "../../features/context/cli";
import { run as runContext } from "../../features/context/cli";

export type ContextStatus = "idle" | "loading" | "success" | "error";

export interface UseContextState {
	status: ContextStatus;
	data?: ContextRunResult;
	error?: SdkError;
}

export interface UseContextResult {
	state: UseContextState;
	run: (input: ContextRunInput) => Promise<void>;
	reset: () => void;
}

export function useContext(): UseContextResult {
	const [state, setState] = useState<UseContextState>({ status: "idle" });

	const run = useCallback(async (input: ContextRunInput) => {
		setState({ status: "loading" });
		const result = await runContext(input);
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
