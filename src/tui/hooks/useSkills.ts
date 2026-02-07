import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	SkillsRunInput,
	SkillsRunResult,
} from "../../features/skills/cli";
import { run as runSkills } from "../../features/skills/cli";

export type SkillsStatus = "idle" | "loading" | "success" | "error";

export interface UseSkillsState {
	status: SkillsStatus;
	data?: SkillsRunResult;
	error?: SdkError;
}

export interface UseSkillsResult {
	state: UseSkillsState;
	run: (input: SkillsRunInput) => Promise<void>;
	reset: () => void;
}

export function useSkills(): UseSkillsResult {
	const [state, setState] = useState<UseSkillsState>({ status: "idle" });

	const run = useCallback(async (input: SkillsRunInput) => {
		setState({ status: "loading" });
		const result = await runSkills(input);
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
