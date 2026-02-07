import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type {
	SearchRunInput,
	SearchRunResult,
} from "../../features/search/cli";
import { run as runSearch } from "../../features/search/cli";

export type SearchStatus = "idle" | "loading" | "success" | "error";

export interface UseSearchState {
	status: SearchStatus;
	data?: SearchRunResult;
	error?: SdkError;
}

export interface UseSearchResult {
	state: UseSearchState;
	run: (input: SearchRunInput) => Promise<void>;
	reset: () => void;
}

export function useSearch(): UseSearchResult {
	const [state, setState] = useState<UseSearchState>({ status: "idle" });

	const run = useCallback(async (input: SearchRunInput) => {
		setState({ status: "loading" });
		const result = await runSearch(input);
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
