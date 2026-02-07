import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { PrRunInput, PrRunResult } from "../../features/pr/cli";
import { run as runPr } from "../../features/pr/cli";

export type PrStatus = "idle" | "loading" | "success" | "error";

export interface UsePrState {
	status: PrStatus;
	data?: PrRunResult;
	error?: SdkError;
}

export interface UsePrResult {
	state: UsePrState;
	run: (input: PrRunInput) => Promise<void>;
	reset: () => void;
}

export function usePr(): UsePrResult {
	const [state, setState] = useState<UsePrState>({ status: "idle" });

	const run = useCallback(async (input: PrRunInput) => {
		setState({ status: "loading" });
		const result = await runPr(input);
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
