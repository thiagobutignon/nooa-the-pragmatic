import { useCallback, useEffect, useRef, useState } from "react";
import { run, streamAi } from "../../features/ai/cli";
import type { AiRunInput, AiRunResult } from "../../features/ai/cli";
import type { SdkError } from "../../core/types";

export type AiStatus = "idle" | "loading" | "streaming" | "success" | "error";

export interface UseAiState {
	status: AiStatus;
	content?: string;
	mode?: AiRunResult["mode"];
	provider?: string;
	model?: string;
	usage?: AiRunResult["usage"];
	error?: SdkError;
}

export interface UseAiResult {
	state: UseAiState;
	run: (input: AiRunInput) => Promise<void>;
	stream: (input: AiRunInput) => Promise<void>;
	reset: () => void;
}

export function useAi(): UseAiResult {
	const [state, setState] = useState<UseAiState>({ status: "idle" });
	const activeRef = useRef(true);

	useEffect(() => {
		activeRef.current = true;
		return () => {
			activeRef.current = false;
		};
	}, []);

	const reset = useCallback(() => {
		setState({ status: "idle" });
	}, []);

	const runAi = useCallback(async (input: AiRunInput) => {
		setState({ status: "loading" });
		const result = await run({ ...input, stream: false });
		if (!activeRef.current) return;
		if (!result.ok) {
			setState({ status: "error", error: result.error });
			return;
		}
		setState({
			status: "success",
			mode: result.data.mode,
			content: result.data.content,
			provider: result.data.provider,
			model: result.data.model,
			usage: result.data.usage,
		});
	}, []);

	const stream = useCallback(async (input: AiRunInput) => {
		setState({ status: "streaming", content: "" });
		const iterator = await streamAi({ ...input, stream: true });
		let content = "";
		let finalMode: AiRunResult["mode"] = "ai";
		let provider: string | undefined;
		let model: string | undefined;
		let usage: AiRunResult["usage"];

		while (true) {
			const next = await iterator.next();
			if (!activeRef.current) return;
			if (next.done) {
				finalMode = "ai";
				provider = next.value.provider;
				model = next.value.model;
				usage = next.value.usage;
				break;
			}
			if (next.value?.content) {
				content += next.value.content;
				setState((prev) => ({
					...prev,
					status: "streaming",
					content,
				}));
			}
		}

		setState({
			status: "success",
			mode: finalMode,
			content,
			provider,
			model,
			usage,
		});
	}, []);

	return { state, run: runAi, stream, reset };
}
