#!/usr/bin/env bun
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import Gradient from "ink-gradient";

const theme = {
	background: "black",
	primary: "cyan",
	accent: "green",
	muted: "gray",
	warn: "yellow",
};

const HEADER = "NOOA :: Hypergrowth Console";
const SUBHEADER = "Minimal agent-first TUI (prototype)";
const MODEL_LABEL = "Model: claude-code / codex";

const sampleMessages = [
	{ role: "system", text: "You are NOOA. Optimize for speed and clarity." },
	{ role: "user", text: "Show me the current project context." },
	{
		role: "assistant",
		text: "Loaded context: read feature, command-builder, docs/features.",
	},
	{ role: "user", text: "List modified files." },
	{
		role: "assistant",
		text: "package.json, src/features/pwd/cli.ts, src/tui/screens/read/ReadFileDialog.tsx",
	},
];

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
}: {
	title: string;
	children: React.ReactNode;
	width?: number | string;
	height?: number;
}) {
	return (
		<Box
			borderStyle="round"
			borderColor={theme.muted}
			flexDirection="column"
			paddingX={1}
			paddingY={0}
			width={width}
			height={height}
		>
			<Text color={theme.muted}>{title}</Text>
			<Box flexDirection="column" marginTop={1}>
				{children}
			</Box>
		</Box>
	);
}

function ChatMessage({ role, text }: { role: string; text: string }) {
	const roleColor = role === "user" ? theme.primary : theme.accent;
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text color={roleColor}>{role.toUpperCase()}</Text>
			<Text>{text}</Text>
		</Box>
	);
}

function InputBar({ value }: { value: string }) {
	return (
		<Box
			borderStyle="round"
			borderColor={theme.primary}
			paddingX={1}
			paddingY={0}
		>
			<Text color={theme.primary}>›</Text>
			<Text> {value}</Text>
			<Text color={theme.muted}> ▋</Text>
		</Box>
	);
}

export function PrototypeApp() {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [showContext, setShowContext] = useState(true);
	const [showFiles, setShowFiles] = useState(true);
	const [draft] = useState("Ask NOOA to refactor read...");
	const resizeTimer = useRef<Timer | null>(null);
	const [viewport, setViewport] = useState(() => ({
		columns: stdout?.columns ?? 80,
		rows: stdout?.rows ?? 24,
	}));

	const clearScreen = () => {
		if (stdout) {
			stdout.write("\u001b[2J\u001b[H");
		}
	};

	useEffect(() => {
		clearScreen();
		const handleResize = () => {
			if (resizeTimer.current) {
				clearTimeout(resizeTimer.current);
			}
			resizeTimer.current = setTimeout(() => {
				setViewport({
					columns: stdout?.columns ?? 80,
					rows: stdout?.rows ?? 24,
				});
				clearScreen();
			}, 120);
		};
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
			if (resizeTimer.current) {
				clearTimeout(resizeTimer.current);
			}
		};
	}, [stdout]);

	useInput((input, key) => {
		if (key.escape || input === "q") exit();
		if (input === "c") setShowContext((v) => !v);
		if (input === "f") setShowFiles((v) => !v);
	});

	const chat = useMemo(
		() =>
			sampleMessages.map((message, index) => (
				<ChatMessage key={`${message.role}-${index}`} {...message} />
			)),
		[],
	);

	const headerHeight = 3;
	const footerHeight = 3;
	const bodyHeight = Math.max(viewport.rows - headerHeight - footerHeight, 6);

	return (
		<Box flexDirection="column" paddingX={1} paddingY={0} height={viewport.rows}>
			<Box height={headerHeight} flexDirection="column" justifyContent="center">
				<Box justifyContent="space-between">
					<Gradient name="atlas">
						<Text bold>{HEADER}</Text>
					</Gradient>
					<Text color={theme.muted}>{MODEL_LABEL}</Text>
				</Box>
				<Text color={theme.muted}>{SUBHEADER}</Text>
				<Text color={theme.muted}>
					Shortcuts: <Text color={theme.primary}>c</Text> context{" "}
					<Text color={theme.primary}>f</Text> files{" "}
					<Text color={theme.primary}>q</Text> quit
				</Text>
			</Box>

			<Box gap={1} height={bodyHeight}>
				{showContext && (
					<Panel title="Context" width={28} height={bodyHeight}>
						{contextItems.map((item) => (
							<Text key={item} color={theme.muted}>
								• {item}
							</Text>
						))}
					</Panel>
				)}

				<Box flexDirection="column" flexGrow={1} height={bodyHeight}>
					<Panel title="Chat" height={bodyHeight}>
						{chat}
						<Box marginTop={1}>
							<Text color={theme.muted}>
								Latest: ready for next command.
							</Text>
						</Box>
					</Panel>
				</Box>

				{showFiles && (
					<Panel title="Modified Files" width={32} height={bodyHeight}>
						{modifiedFiles.map((file) => (
							<Text key={file} color={theme.muted}>
								{file}
							</Text>
						))}
					</Panel>
				)}
			</Box>

			<Box height={footerHeight} justifyContent="center">
				<InputBar value={draft} />
			</Box>
		</Box>
	);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
	console.error("Error: NOOA TUI requires a TTY. Run in an interactive terminal.");
	process.exit(1);
}

process.stdout.write("\u001b[2J\u001b[H");

import { render } from "ink";

render(<PrototypeApp />);
