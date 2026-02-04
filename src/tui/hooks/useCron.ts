import { useCallback, useState } from "react";
import { run as runCron } from "../../features/cron/cli";
import type { CronRunInput, CronRunResult } from "../../features/cron/cli";
import type { SdkError } from "../../core/types";

export type CronStatus = "idle" | "loading" | "success" | "error";

export interface UseCronState {
	status: CronStatus;
	data?: CronRunResult;
	error?: SdkError;
}

export interface UseCronResult {
	state: UseCronState;
	run: (input: CronRunInput) => Promise<void>;
	reset: () => void;
}

export function useCron(): UseCronResult {
	const [state, setState] = useState<UseCronState>({ status: "idle" });

	const run = useCallback(async (input: CronRunInput) => {
		setState({ status: "loading" });
		const result = await runCron(input);
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
