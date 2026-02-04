import { useCallback, useState } from "react";
import { run as runPush } from "../../features/push/cli";
import type { PushRunInput, PushRunResult } from "../../features/push/cli";
import type { SdkError } from "../../core/types";

export type PushStatus = "idle" | "loading" | "success" | "error";

export interface UsePushState {
	status: PushStatus;
	data?: PushRunResult;
	error?: SdkError;
}

export interface UsePushResult {
	state: UsePushState;
	run: (input: PushRunInput) => Promise<void>;
	reset: () => void;
}

export function usePush(): UsePushResult {
	const [state, setState] = useState<UsePushState>({ status: "idle" });

	const run = useCallback(async (input: PushRunInput) => {
		setState({ status: "loading" });
		const result = await runPush(input);
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
