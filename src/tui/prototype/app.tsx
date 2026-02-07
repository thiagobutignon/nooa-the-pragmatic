#!/usr/bin/env bun
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import Gradient from "ink-gradient";
import TextInput from "ink-text-input";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { telemetry } from "../../core/telemetry";
import { reconstituteState, type WorkerView } from "../shared/state";
import { runAiStream } from "./ai-runner";
import { runNooaCommand } from "./command-runner";
import {
	appendLogLine,
	type LogEvent,
	resolveDefaultLogPath,
} from "./log-writer";
import {
	disableMouseTracking,
	enableMouseTracking,
	parseMouseScroll,
} from "./mouse";
import { buildScrollState } from "./scroll";
import { type AgentManifest, buildSystemPrompt } from "./system-prompt";

const theme = {
	background: "black",
	primary: "cyan",
	accent: "green",
	muted: "gray",
	warn: "yellow",
};

const HEADER = "NOOA :: Hypergrowth Console";
const SUBHEADER = "Minimal agent-first TUI (prototype)";
const MODEL_LABEL = "Model: claude-code / codex (stream)";

const contextItems = [
	"Goal: ship hypergrowth CLI + TUI",
	"Active feature: read / pwd",
	"Mode: agent-first contracts",
	"Docs: docs/features",
];

const modifiedFiles = [
	"package.json",
	"src/features/pwd/cli.ts",
	"src/features/read/cli.ts",
	"src/tui/screens/read/ReadFileDialog.tsx",
	"src/tui/hooks/useRead.ts",
];

function Panel({
	title,
	children,
	width,
	height,
	borderColor = theme.muted,
}: {
	title: string;
	children: React.ReactNode;
	width?: number | string;
	height?: number;
	borderColor?: string;
}) {
	return (
		<Box
			borderStyle="round"
			borderColor={borderColor}
			flexDirection="column"
			paddingX={1}
			paddingY={0}
			width={width}
			height={height}
		>
			<Text color={borderColor}>{title}</Text>
			<Box flexDirection="column" marginTop={1}>
				{children}
			</Box>
		</Box>
	);
}

function _WorkflowStatus({ worker }: { worker: WorkerView }) {
	const color =
		worker.status === "active"
			? theme.accent
			: worker.status === "failed"
				? theme.warn
				: theme.muted;
	return (
		<Box flexDirection="column">
			<Box justifyContent="space-between">
				<Text bold color={color}>
					{worker.status.toUpperCase()}
				</Text>
				<Text dimColor>{worker.id.slice(0, 6)}</Text>
			</Box>
			<Text>Goal: {worker.goal}</Text>
			{worker.gates.length > 0 && (
				<Text color={theme.primary}>✔ Gates: {worker.gates.join(" → ")}</Text>
			)}
			{worker.lastGate?.status === "fail" && (
				<Text color={theme.warn}>✘ Failed at: {worker.lastGate.id}</Text>
			)}
		</Box>
	);
}

type ChatRole = "system" | "user" | "assistant" | "error";

type ChatMessage = {
	id: string;
	role: ChatRole;
	text: string;
};

function ChatMessage({ role, text }: { role: ChatRole; text: string }) {
	const roleColor =
		role === "user"
			? theme.primary
			: role === "error"
				? theme.warn
				: theme.accent;
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text color={roleColor}>{role.toUpperCase()}</Text>
			<Text>{text}</Text>
		</Box>
	);
}

function InputBar({
	value,
	onChange,
	onSubmit,
	disabled,
	status,
}: {
	value: string;
	onChange: (next: string) => void;
	onSubmit: (next: string) => void;
	disabled: boolean;
	status?: string;
}) {
	return (
		<Box
			borderStyle="round"
			borderColor={theme.primary}
			paddingX={1}
			paddingY={0}
		>
			<Text color={theme.primary}>›</Text>
			<Box flexGrow={1} marginLeft={1}>
				<TextInput
					value={value}
					onChange={onChange}
					onSubmit={onSubmit}
					placeholder={disabled ? "Streaming..." : "Escreva um comando..."}
					focus={!disabled}
				/>
			</Box>
			<Text color={theme.muted}>{status ? ` ${status}` : " ▋"}</Text>
		</Box>
	);
}

export function PrototypeApp() {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [showContext] = useState(false);
	const [showFiles] = useState(false);
	const [draft, setDraft] = useState("");
	const [status, setStatus] = useState<string | undefined>();
	const stderrBuffer = useRef("");
	const assistantBuffer = useRef("");
	const [systemPrompt, setSystemPrompt] = useState(
		"You are NOOA. Optimize for speed and clarity.",
	);
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{
			id: "system",
			role: "system",
			text: "You are NOOA. Optimize for speed and clarity.",
		},
	]);
	const [logs, setLogs] = useState<string[]>([]);
	const logFileRef = useRef<string | null>(null);
	const scrollStateRef = useRef(
		buildScrollState({ totalLines: 0, viewportLines: 10 }),
	);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [isStreaming, setIsStreaming] = useState(false);
	const resizeTimer = useRef<Timer | null>(null);
	const streamRef = useRef<ReturnType<typeof runAiStream> | null>(null);
	const [viewport, setViewport] = useState(() => ({
		columns: stdout?.columns ?? 80,
		rows: stdout?.rows ?? 24,
	}));
	// Workflow State
	const [_workers, setWorkers] = useState<WorkerView[]>([]);

	useEffect(() => {
		const refresh = () => {
			const rows = telemetry.list({ limit: 100 });
			const nextWorkers = reconstituteState(rows);
			// Filter for recent/active
			const active = nextWorkers.filter(
				(w) => w.status === "active" || Date.now() - w.lastEventTime < 10000,
			);
			setWorkers(active.reverse());
		};
		const timer = setInterval(refresh, 500);
		return () => clearInterval(timer);
	}, []);

	const clearScreen = () => {
		if (stdout) {
			stdout.write("\u001b[2J\u001b[H\u001b[3J");
		}
	};

	useEffect(() => {
		clearScreen();
		const repoRoot = resolve(import.meta.dir, "../../..");
		const logPath = resolveDefaultLogPath();
		logFileRef.current = logPath;
		void mkdir(resolve(logPath, ".."), { recursive: true });
		appendLogLine(logPath, {
			type: "session.start",
			message: "tui prototype started",
		}).catch(() => {});

		void (async () => {
			try {
				const manifestText = await readFile(
					resolve(repoRoot, ".nooa/AGENT_MANIFEST.json"),
					"utf-8",
				);
				const manifest = JSON.parse(manifestText) as AgentManifest;
				const prompt = await buildSystemPrompt(manifest);
				setSystemPrompt(prompt);
				setMessages((prev) => [
					{
						id: "system",
						role: "system",
						text: prompt,
					},
					...prev.filter((message) => message.id !== "system"),
				]);
			} catch {
				// fallback to default system prompt
			}
		})();
		const handleResize = () => {
			if (resizeTimer.current) {
				clearTimeout(resizeTimer.current);
			}
			resizeTimer.current = setTimeout(() => {
				setViewport({
					columns: stdout?.columns ?? 80,
					rows: stdout?.rows ?? 24,
				});
				scrollStateRef.current.setViewportLines(
					Math.max(6, (stdout?.rows ?? 24) - 8),
				);
				setScrollOffset(scrollStateRef.current.getOffset());
				clearScreen();
			}, 120);
		};
		stdout?.on("resize", handleResize);

		const enable = enableMouseTracking();
		stdout?.write(enable);

		return () => {
			stdout?.off("resize", handleResize);
			stdout?.write(disableMouseTracking());
			if (resizeTimer.current) {
				clearTimeout(resizeTimer.current);
			}
		};
	}, [stdout, clearScreen]);

	useInput((input, key) => {
		if (key.ctrl && input === "c") exit();
		if (key.upArrow) {
			scrollStateRef.current.scrollBy(-1);
			setScrollOffset(scrollStateRef.current.getOffset());
		}
		if (key.downArrow) {
			scrollStateRef.current.scrollBy(1);
			setScrollOffset(scrollStateRef.current.getOffset());
		}
		if (key.pageUp) {
			scrollStateRef.current.pageUp();
			setScrollOffset(scrollStateRef.current.getOffset());
		}
		if (key.pageDown) {
			scrollStateRef.current.pageDown();
			setScrollOffset(scrollStateRef.current.getOffset());
		}
		if (input) {
			const direction = parseMouseScroll(input);
			if (direction === "up") {
				scrollStateRef.current.scrollBy(-3);
				setScrollOffset(scrollStateRef.current.getOffset());
			}
			if (direction === "down") {
				scrollStateRef.current.scrollBy(3);
				setScrollOffset(scrollStateRef.current.getOffset());
			}
		}
	});

	const chat = useMemo(() => {
		const maxMessages = Math.max(6, viewport.rows - 10);
		const visibleMessages = messages.slice(
			scrollOffset,
			scrollOffset + maxMessages,
		);
		return visibleMessages.map((message) => (
			<ChatMessage key={message.id} role={message.role} text={message.text} />
		));
	}, [messages, viewport.rows, scrollOffset]);

	const logPanel = useMemo(() => {
		const lines = logs.slice(-12);
		return lines.map((line, index) => (
			<Text key={`${line}-${index}`} color={theme.muted}>
				{line}
			</Text>
		));
	}, [logs]);

	const appendLog = (line: string, event?: LogEvent) => {
		setLogs((prev) => [...prev, line].slice(-200));
		const logPath = logFileRef.current;
		if (logPath && event) {
			appendLogLine(logPath, event).catch(() => {});
		}
	};

	const handleSubmit = (value: string) => {
		const prompt = value.trim();
		if (!prompt || isStreaming) return;

		setDraft("");
		setStatus("executando...");
		setIsStreaming(true);
		stderrBuffer.current = "";

		const userId = `user-${Date.now()}`;
		const assistantId = `assistant-${Date.now()}`;

		const isCommand = prompt.startsWith("!nooa ");
		setMessages((prev) => [
			...prev,
			{ id: userId, role: "user", text: prompt },
			{ id: assistantId, role: "assistant", text: "" },
		]);
		appendLog(isCommand ? "dispatch: nooa command" : "dispatch: ai", {
			type: "dispatch",
			message: isCommand ? "nooa command" : "ai",
			metadata: { input: prompt },
		});

		streamRef.current?.stop();
		const repoRoot = resolve(import.meta.dir, "../../..");

		const provider = process.env.NOOA_TUI_PROVIDER ?? "groq";
		const model = process.env.NOOA_TUI_MODEL ?? process.env.NOOA_AI_MODEL;

		if (isCommand) {
			// Robustly strip '!nooa' prefix
			let commandText = prompt.startsWith("!nooa")
				? prompt.slice(5).trim()
				: prompt;
			// Also strip 'nooa' if user typed '!nooa nooa' or auto-execute added it redundantly
			if (commandText.startsWith("nooa ")) {
				commandText = commandText.slice(5).trim();
			}

			appendLog(`running: ${commandText}`, {
				type: "info",
				message: `running: ${commandText}`,
			});

			const repoRoot = resolve(import.meta.dir, "../../..");
			streamRef.current?.stop();
			streamRef.current = runNooaCommand(
				commandText,
				{ cwd: repoRoot },
				{
					onStdout: (chunk) => {
						setMessages((prev) =>
							prev.map((message) =>
								message.id === assistantId
									? { ...message, text: `${message.text}${chunk}` }
									: message,
							),
						);
					},
					onStderr: (chunk) => {
						const next = chunk.trim();
						if (!next) return;
						appendLog(next, { type: "stderr", message: next });
						setStatus(next);
					},
					onExit: (code) => {
						setIsStreaming(false);
						setStatus(code === 0 ? undefined : `erro (${code})`);
						appendLog(`exit: ${code}`, {
							type: "exit",
							message: String(code),
						});
						if (code !== 0) {
							setMessages((prev) => [
								...prev,
								{
									id: `error-${Date.now()}`,
									role: "error",
									text: "Falha ao executar nooa.",
								},
							]);
						}
					},
				},
			);
			return;
		}

		const finalPrompt = `${systemPrompt}\n\nUsuário: ${prompt}\nAssistente:`;
		assistantBuffer.current = "";

		streamRef.current = runAiStream(
			finalPrompt,
			{ stream: true, cwd: repoRoot, provider, model },
			{
				onStdout: (chunk) => {
					assistantBuffer.current += chunk;
					setMessages((prev) =>
						prev.map((message) =>
							message.id === assistantId
								? {
										...message,
										text: `${message.text}${chunk}`,
									}
								: message,
						),
					);
				},
				onStderr: (chunk) => {
					const next = chunk.trim();
					if (!next || next.startsWith('{"level"')) return;
					if (!next) return;
					stderrBuffer.current = `${stderrBuffer.current}\n${next}`.trim();
					appendLog(next, { type: "stderr", message: next });
					setStatus(next);
				},
				onExit: (code) => {
					setIsStreaming(false);
					setStatus(code === 0 ? undefined : `erro (${code})`);
					appendLog(`exit: ${code}`, {
						type: "exit",
						message: String(code),
					});

					// Auto-Execute Logic
					const fullText = assistantBuffer.current;
					const bashMatch = fullText.match(/```(?:bash|sh)\n([\s\S]*?)```/);
					if (bashMatch?.[1]) {
						const commandToRun = bashMatch[1].trim();
						// Strip leading 'nooa' if present, as runNooaCommand adds 'index.ts'
						// and we want 'index.ts <subcommand> ...'
						const cleanCommand = commandToRun.replace(/^nooa\s+/, "");
						appendLog(`Auto-executing: ${cleanCommand.slice(0, 40)}...`, {
							type: "info",
							message: "Auto-executing detected block",
						});
						setTimeout(() => handleSubmit(`!nooa ${cleanCommand}`), 100);
					}

					if (code !== 0) {
						const errorText =
							stderrBuffer.current || "Falha ao executar nooa ai.";
						setMessages((prev) => [
							...prev,
							{
								id: `error-${Date.now()}`,
								role: "error",
								text: errorText,
							},
						]);
					}
				},
			},
		);
	};

	return (
		<Box
			flexDirection="column"
			paddingX={1}
			paddingY={0}
			height={viewport.rows}
		>
			<Box flexDirection="column" flexShrink={0} marginTop={0}>
				<Box justifyContent="space-between">
					<Gradient name="atlas">
						<Text bold>{HEADER}</Text>
					</Gradient>
					<Text color={theme.muted}>{MODEL_LABEL}</Text>
				</Box>
				<Text color={theme.muted}>{SUBHEADER}</Text>
			</Box>

			<Box gap={1} flexGrow={1} minHeight={6}>
				{showContext && (
					<Panel title="Context" width={28}>
						{contextItems.map((item) => (
							<Text key={item} color={theme.muted}>
								• {item}
							</Text>
						))}
					</Panel>
				)}

				<Box flexDirection="column" flexGrow={1} minHeight={6}>
					<Panel title="Chat">
						{chat}
						<Box marginTop={1}>
							<Text color={theme.muted}>
								{isStreaming ? "Streaming…" : "Pronto para o próximo comando."}
							</Text>
						</Box>
					</Panel>
					<Box marginTop={1}>
						<Panel title="Logs">{logPanel}</Panel>
					</Box>
				</Box>

				{showFiles && (
					<Panel title="Modified Files" width={32}>
						{modifiedFiles.map((file) => (
							<Text key={file} color={theme.muted}>
								{file}
							</Text>
						))}
					</Panel>
				)}
			</Box>

			<Box flexShrink={0} marginTop={0}>
				<InputBar
					value={draft}
					onChange={setDraft}
					onSubmit={handleSubmit}
					disabled={isStreaming}
					status={status}
				/>
			</Box>
		</Box>
	);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
	console.error(
		"Error: NOOA TUI requires a TTY. Run in an interactive terminal.",
	);
	process.exit(1);
}

process.stdout.write("\u001b[2J\u001b[H");

import { render } from "ink";

render(<PrototypeApp />);
