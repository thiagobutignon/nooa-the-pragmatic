import { useCallback, useState } from "react";
import { run } from "../../features/read/cli";
import type { ReadRunInput, ReadRunResult } from "../../features/read/cli";
import type { SdkError } from "../../core/types";

export type ReadStatus = "idle" | "loading" | "success" | "error";

export interface UseReadState {
	status: ReadStatus;
	data?: ReadRunResult;
	error?: SdkError;
	lastPath?: string;
}

export interface UseReadResult {
	state: UseReadState;
	read: (input: ReadRunInput) => Promise<void>;
	reset: () => void;
}

export function useRead(): UseReadResult {
	const [state, setState] = useState<UseReadState>({ status: "idle" });

	const read = useCallback(async (input: ReadRunInput) => {
		const path = input.path?.trim();
		setState({ status: "loading", lastPath: path });

		const result = await run({ ...input, path });
		if (!result.ok) {
			setState({
				status: "error",
				error: result.error,
				lastPath: path,
			});
			return;
		}

		setState({
			status: "success",
			data: result.data,
			lastPath: path,
		});
	}, []);

	const reset = useCallback(() => {
		setState({ status: "idle" });
	}, []);

	return { state, read, reset };
}
