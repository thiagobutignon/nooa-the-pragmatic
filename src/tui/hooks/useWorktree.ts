import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	WorktreeRunInput,
	WorktreeRunResult,
} from "../../features/worktree/cli";
import { run as runWorktree } from "../../features/worktree/cli";

export type WorktreeStatus = "idle" | "loading" | "success" | "error";

export interface UseWorktreeState {
	status: WorktreeStatus;
	data?: WorktreeRunResult;
	error?: SdkError;
}

export interface UseWorktreeResult {
	state: UseWorktreeState;
	run: (input: WorktreeRunInput) => Promise<void>;
	reset: () => void;
}

export function useWorktree(): UseWorktreeResult {
	const [state, setState] = useState<UseWorktreeState>({ status: "idle" });

	const run = useCallback(async (input: WorktreeRunInput) => {
		setState({ status: "loading" });
		const result = await runWorktree(input);
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
