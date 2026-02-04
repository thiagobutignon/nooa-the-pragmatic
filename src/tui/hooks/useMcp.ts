import { useCallback, useState } from "react";
import { run as runMcp } from "../../features/mcp/cli";
import type { McpRunInput, McpRunResult } from "../../features/mcp/cli";
import type { SdkError } from "../../core/types";

export type McpStatus = "idle" | "loading" | "success" | "error";

export interface UseMcpState {
	status: McpStatus;
	data?: McpRunResult;
	error?: SdkError;
}

export interface UseMcpResult {
	state: UseMcpState;
	run: (input: McpRunInput) => Promise<void>;
	reset: () => void;
}

export function useMcp(): UseMcpResult {
	const [state, setState] = useState<UseMcpState>({ status: "idle" });

	const run = useCallback(async (input: McpRunInput) => {
		setState({ status: "loading" });
		const result = await runMcp(input);
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
