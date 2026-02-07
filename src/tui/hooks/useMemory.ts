import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	MemoryRunInput,
	MemoryRunResult,
} from "../../features/memory/cli";
import { run as runMemory } from "../../features/memory/cli";

export type MemoryStatus = "idle" | "loading" | "success" | "error";

export interface UseMemoryState {
	status: MemoryStatus;
	data?: MemoryRunResult;
	error?: SdkError;
}

export interface UseMemoryResult {
	state: UseMemoryState;
	run: (input: MemoryRunInput) => Promise<void>;
	reset: () => void;
}

export function useMemory(): UseMemoryResult {
	const [state, setState] = useState<UseMemoryState>({ status: "idle" });

	const run = useCallback(async (input: MemoryRunInput) => {
		setState({ status: "loading" });
		const result = await runMemory(input);
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
