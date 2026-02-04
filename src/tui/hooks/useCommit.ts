import { useCallback, useState } from "react";
import { run as runCommit } from "../../features/commit/cli";
import type { CommitRunInput, CommitRunResult } from "../../features/commit/cli";
import type { SdkError } from "../../core/types";

export type CommitStatus = "idle" | "loading" | "success" | "error";

export interface UseCommitState {
	status: CommitStatus;
	data?: CommitRunResult;
	error?: SdkError;
}

export interface UseCommitResult {
	state: UseCommitState;
	run: (input: CommitRunInput) => Promise<void>;
	reset: () => void;
}

export function useCommit(): UseCommitResult {
	const [state, setState] = useState<UseCommitState>({ status: "idle" });

	const run = useCallback(async (input: CommitRunInput) => {
		setState({ status: "loading" });
		const result = await runCommit(input);
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
