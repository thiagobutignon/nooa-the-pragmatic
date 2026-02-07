import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	PromptRunInput,
	PromptRunResult,
} from "../../features/prompt/cli";
import { run as runPrompt } from "../../features/prompt/cli";

export type PromptStatus = "idle" | "loading" | "success" | "error";

export interface UsePromptState {
	status: PromptStatus;
	data?: PromptRunResult;
	error?: SdkError;
}

export interface UsePromptResult {
	state: UsePromptState;
	run: (input: PromptRunInput) => Promise<void>;
	reset: () => void;
}

export function usePrompt(): UsePromptResult {
	const [state, setState] = useState<UsePromptState>({ status: "idle" });

	const run = useCallback(async (input: PromptRunInput) => {
		setState({ status: "loading" });
		const result = await runPrompt(input);
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
