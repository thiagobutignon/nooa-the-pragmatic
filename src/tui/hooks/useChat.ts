import { useCallback, useState } from "react";
import { run as runMessage } from "../../features/chat/cli";
import type { MessageRunInput, MessageRunResult } from "../../features/chat/cli";
import type { SdkError } from "../../core/types";

export type ChatStatus = "idle" | "loading" | "success" | "error";

export interface UseChatState {
	status: ChatStatus;
	data?: MessageRunResult;
	error?: SdkError;
}

export interface UseChatResult {
	state: UseChatState;
	run: (input: MessageRunInput) => Promise<void>;
	reset: () => void;
}

export function useChat(): UseChatResult {
	const [state, setState] = useState<UseChatState>({ status: "idle" });

	const run = useCallback(async (input: MessageRunInput) => {
		setState({ status: "loading" });
		const result = await runMessage(input);
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
