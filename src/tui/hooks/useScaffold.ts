import { useCallback, useState } from "react";
import { run as runScaffold } from "../../features/scaffold/cli";
import type { ScaffoldRunInput, ScaffoldRunResult } from "../../features/scaffold/cli";
import type { SdkError } from "../../core/types";

export type ScaffoldStatus = "idle" | "loading" | "success" | "error";

export interface UseScaffoldState {
	status: ScaffoldStatus;
	data?: ScaffoldRunResult;
	error?: SdkError;
}

export interface UseScaffoldResult {
	state: UseScaffoldState;
	run: (input: ScaffoldRunInput) => Promise<void>;
	reset: () => void;
}

export function useScaffold(): UseScaffoldResult {
	const [state, setState] = useState<UseScaffoldState>({ status: "idle" });

	const run = useCallback(async (input: ScaffoldRunInput) => {
		setState({ status: "loading" });
		const result = await runScaffold(input);
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
