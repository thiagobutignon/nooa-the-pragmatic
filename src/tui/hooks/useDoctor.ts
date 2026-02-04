import { useCallback, useState } from "react";
import { run as runDoctor } from "../../features/doctor/cli";
import type { DoctorRunInput, DoctorRunResult } from "../../features/doctor/cli";
import type { SdkError } from "../../core/types";

export type DoctorStatus = "idle" | "loading" | "success" | "error";

export interface UseDoctorState {
	status: DoctorStatus;
	data?: DoctorRunResult;
	error?: SdkError;
}

export interface UseDoctorResult {
	state: UseDoctorState;
	run: (input: DoctorRunInput) => Promise<void>;
	reset: () => void;
}

export function useDoctor(): UseDoctorResult {
	const [state, setState] = useState<UseDoctorState>({ status: "idle" });

	const run = useCallback(async (input: DoctorRunInput) => {
		setState({ status: "loading" });
		const result = await runDoctor(input);
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
