import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useEffect, useRef, useState } from "react";
import { ActEngine, type ActEvent } from "../../features/act/engine";

interface ActScreenProps {
	onBack: () => void;
}

type LogLine = {
	type:
		| "info"
		| "error"
		| "thinking"
		| "result"
		| "user"
		| "command"
		| "output";
	content: string;
};

export function ActScreen({ onBack }: ActScreenProps) {
	const [inputValue, setInputValue] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [logs, setLogs] = useState<LogLine[]>([]);
	const [scrollOffset, setScrollOffset] = useState(0);

	// We instantiate engine once (or per run).
	// Since ActEngine is stateless per request (mostly), we can effectively recreate it or keep a ref.
	const engineRef = useRef<ActEngine | null>(null);

	useEffect(() => {
		// Initialize engine
		engineRef.current = new ActEngine();
	}, []);

	useInput((_input, key) => {
		if (key.escape) {
			onBack();
		}
		// Scrolling (Arrows)
		if (key.upArrow) {
			setScrollOffset((prev) => Math.max(0, prev - 1));
		}
		if (key.downArrow) {
			setScrollOffset((prev) => prev + 1);
		}
	});

	const addLog = (type: LogLine["type"], content: string) => {
		setLogs((prev) => [...prev, { type, content }]);
		setScrollOffset(0); // Auto-scroll to bottom
	};

	const handleSubmit = async (value: string) => {
		if (!value.trim() || isRunning) return;
		if (!engineRef.current) return; // Should be ready

		addLog("user", `> ${value}`);
		setInputValue("");
		setIsRunning(true);

		try {
			const result = await engineRef.current.execute(value, {
				provider: "groq",
				model: "qwen2.5-coder",
				onEvent: (event: ActEvent) => {
					// Map engine events to TUI logs
					if (event.type === "thought") addLog("thinking", event.content);
					if (event.type === "command")
						addLog("command", `Running: ${event.content}`);
					if (event.type === "output") addLog("output", event.content); // Maybe truncate output in UI if too long?
					if (event.type === "error") addLog("error", event.content);
				},
			});

			if (result.ok) {
				addLog("result", result.data.finalAnswer);
			} else {
				addLog("error", result.error?.message || "Unknown error");
			}
		} catch (err: any) {
			addLog("error", err.message);
		} finally {
			setIsRunning(false);
		}
	};

	// Rendering Logic
	const viewportHeight = 20;
	const totalLogs = logs.length;
	const startIndex = Math.max(0, totalLogs - viewportHeight - scrollOffset);
	const endIndex = Math.max(0, totalLogs - scrollOffset);
	const visibleLogs = logs.slice(startIndex, endIndex);

	return (
		<Box
			flexDirection="column"
			padding={1}
			borderStyle="single"
			borderColor="cyan"
			height={30}
		>
			<Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
				<Text bold color="cyan">
					NOOA Orchestrator (Direct)
				</Text>
				<Text dimColor>⬆/⬇ scroll • ESC exit</Text>
			</Box>

			{/* Log Viewport */}
			<Box
				flexDirection="column"
				flexGrow={1}
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{visibleLogs.length === 0 && (
					<Text dimColor>Ready. Enter a goal below.</Text>
				)}
				{visibleLogs.map((log, i) => (
					<Box key={startIndex + i} marginBottom={0} flexDirection="column">
						{log.type === "user" && (
							<Text color="green" bold>
								{log.content}
							</Text>
						)}
						{log.type === "thinking" && (
							<Text color="yellow"> 🤔 {log.content}</Text>
						)}
						{log.type === "command" && (
							<Text color="blue"> ⚡ {log.content}</Text>
						)}
						{log.type === "output" && (
							<Box marginLeft={2} borderStyle="single" borderColor="dim">
								<Text dimColor>
									{log.content.slice(0, 200)}
									{log.content.length > 200 ? "..." : ""}
								</Text>
							</Box>
						)}
						{log.type === "result" && (
							<Box
								borderStyle="round"
								borderColor="magenta"
								paddingX={1}
								marginTop={1}
							>
								<Text color="magenta">{log.content}</Text>
							</Box>
						)}
						{log.type === "error" && <Text color="red"> ❌ {log.content}</Text>}
						{log.type === "info" && <Text dimColor> {log.content}</Text>}
					</Box>
				))}
			</Box>

			{/* Input Area */}
			<Box marginTop={1}>
				<Text color={isRunning ? "gray" : "green"}>
					{isRunning ? "Running..." : "Goal:"}{" "}
				</Text>
				{!isRunning && (
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={handleSubmit}
						placeholder="Type your goal here..."
					/>
				)}
			</Box>
		</Box>
	);
}
