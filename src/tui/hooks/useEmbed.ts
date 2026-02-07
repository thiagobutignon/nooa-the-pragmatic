import { useCallback, useState } from "react";
import type { SdkError } from "../../core/types";
import type { EmbedRunInput, EmbedRunResult } from "../../features/embed/cli";
import { run as runEmbed } from "../../features/embed/cli";

export type EmbedStatus = "idle" | "loading" | "success" | "error";

export interface UseEmbedState {
	status: EmbedStatus;
	data?: EmbedRunResult;
	error?: SdkError;
}

export interface UseEmbedResult {
	state: UseEmbedState;
	run: (input: EmbedRunInput) => Promise<void>;
	reset: () => void;
}

export function useEmbed(): UseEmbedResult {
	const [state, setState] = useState<UseEmbedState>({ status: "idle" });

	const run = useCallback(async (input: EmbedRunInput) => {
		setState({ status: "loading" });
		const result = await runEmbed(input);
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
