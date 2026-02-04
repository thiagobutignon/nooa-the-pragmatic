import { useCallback, useState } from "react";
import { run as runIndex } from "../../features/index/cli";
import type { IndexRunInput, IndexRunResult } from "../../features/index/cli";
import type { SdkError } from "../../core/types";

export type IndexStatus = "idle" | "loading" | "success" | "error";

export interface UseIndexState {
	status: IndexStatus;
	data?: IndexRunResult;
	error?: SdkError;
}

export interface UseIndexResult {
	state: UseIndexState;
	run: (input: IndexRunInput) => Promise<void>;
	reset: () => void;
}

export function useIndex(): UseIndexResult {
	const [state, setState] = useState<UseIndexState>({ status: "idle" });

	const run = useCallback(async (input: IndexRunInput) => {
		setState({ status: "loading" });
		const result = await runIndex(input);
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
