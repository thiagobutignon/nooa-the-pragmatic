import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	GuardrailRunInput,
	GuardrailRunResult,
} from "../../features/guardrail/cli";
import { run as runGuardrail } from "../../features/guardrail/cli";

export type GuardrailStatus = "idle" | "loading" | "success" | "error";

export interface UseGuardrailState {
	status: GuardrailStatus;
	data?: GuardrailRunResult;
	error?: SdkError;
}

export interface UseGuardrailResult {
	state: UseGuardrailState;
	run: (input: GuardrailRunInput) => Promise<void>;
	reset: () => void;
}

export function useGuardrail(): UseGuardrailResult {
	const [state, setState] = useState<UseGuardrailState>({ status: "idle" });

	const run = useCallback(async (input: GuardrailRunInput) => {
		setState({ status: "loading" });
		const result = await runGuardrail(input);
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
