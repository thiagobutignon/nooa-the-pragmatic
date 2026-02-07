import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	ReviewRunInput,
	ReviewRunResult,
} from "../../features/review/cli";
import { run as runReview } from "../../features/review/cli";

export type ReviewStatus = "idle" | "loading" | "success" | "error";

export interface UseReviewState {
	status: ReviewStatus;
	data?: ReviewRunResult;
	error?: SdkError;
}

export interface UseReviewResult {
	state: UseReviewState;
	run: (input: ReviewRunInput) => Promise<void>;
	reset: () => void;
}

export function useReview(): UseReviewResult {
	const [state, setState] = useState<UseReviewState>({ status: "idle" });

	const run = useCallback(async (input: ReviewRunInput) => {
		setState({ status: "loading" });
		const result = await runReview(input);
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
