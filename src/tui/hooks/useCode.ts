import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { CodeRunInput, CodeRunResult } from "../../features/code/cli";
import { run as runCode } from "../../features/code/cli";

export type CodeStatus = "idle" | "loading" | "success" | "error";

export interface UseCodeState {
	status: CodeStatus;
	data?: CodeRunResult;
	error?: SdkError;
}

export interface UseCodeResult {
	state: UseCodeState;
	run: (input: CodeRunInput) => Promise<void>;
	reset: () => void;
}

export function useCode(): UseCodeResult {
	const [state, setState] = useState<UseCodeState>({ status: "idle" });

	const run = useCallback(async (input: CodeRunInput) => {
		setState({ status: "loading" });
		const result = await runCode(input);
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
