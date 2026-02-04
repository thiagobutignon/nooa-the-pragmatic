import { useCallback, useState } from "react";
import { run as runCi } from "../../features/ci/cli";
import type { CiRunInput, CiRunResult } from "../../features/ci/cli";
import type { SdkError } from "../../core/types";

export type CiStatus = "idle" | "loading" | "success" | "error";

export interface UseCiState {
	status: CiStatus;
	data?: CiRunResult;
	error?: SdkError;
}

export interface UseCiResult {
	state: UseCiState;
	run: (input: CiRunInput) => Promise<void>;
	reset: () => void;
}

export function useCi(): UseCiResult {
	const [state, setState] = useState<UseCiState>({ status: "idle" });

	const run = useCallback(async (input: CiRunInput) => {
		setState({ status: "loading" });
		const result = await runCi(input);
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
