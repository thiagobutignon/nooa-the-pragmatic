#!/usr/bin/env bun
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const palette = {
	amber: "#FFF",
	dim: "#8c6b20",
	warn: "#ff6b6b",
	bg: "black",
};

const HEADER = "NOOA // SIGNAL TERMINAL";
const STATUS = "Agent-First";
const MODEL = "Model: codex / claude";

const navItems = ["Chat", "Context", "Files", "Runs", "Memory", "Settings"];

const messages = [
	{ role: "assistant", text: "Booted hypergrowth console." },
	{ role: "user", text: "Summarize what changed in read." },
	{
		role: "assistant",
		text: "Added basePath guard and pwd command. TUI uses pwd now.",
	},
];

const recentFiles = [
	"src/features/pwd/cli.ts",
	"src/features/read/cli.ts",
	"src/tui/hooks/useRead.ts",
	"src/tui/prototype-2/app.tsx",
];

const statusLine = [
	"MODE: FOCUS",
	"SAFE: ON",
	"CONTEXT: LOCAL",
	"LATENCY: 38ms",
];

function useSpinner() {
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	const [index, setIndex] = useState(0);
	useEffect(() => {
		const id = setInterval(() => {
			setIndex((prev) => (prev + 1) % frames.length);
		}, 90);
		return () => clearInterval(id);
	}, []);
	return frames[index] ?? "⠋";
}

function Panel({
	title,
	height,
	width,
	children,
}: {
	title: string;
	height: number;
	width?: number;
	children: React.ReactNode;
}) {
	return (
		<Box
			borderStyle="double"
			borderColor={palette.dim}
			height={height}
			width={width}
			flexDirection="column"
			paddingX={1}
		>
			<Text color={palette.dim}>{title}</Text>
			<Box flexDirection="column" marginTop={1} flexGrow={1}>
				{children}
			</Box>
		</Box>
	);
}

export function Prototype2App() {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const spinner = useSpinner();
	const resizeTimer = useRef<Timer | null>(null);
	const [viewport, setViewport] = useState(() => ({
		columns: stdout?.columns ?? 100,
		rows: stdout?.rows ?? 28,
	}));

	const clearScreenCallback = useCallback(() => {
		stdout?.write("\u001b[2J\u001b[H");
	}, [stdout]);

	useEffect(() => {
		clearScreenCallback();
		const handleResize = () => {
			if (resizeTimer.current) clearTimeout(resizeTimer.current);
			resizeTimer.current = setTimeout(() => {
				setViewport({
					columns: stdout?.columns ?? 100,
					rows: stdout?.rows ?? 28,
				});
				clearScreenCallback();
			}, 120);
		};
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
			if (resizeTimer.current) clearTimeout(resizeTimer.current);
		};
	}, [stdout, clearScreenCallback]);

	useInput((input, key) => {
		if (key.escape || input === "q") exit();
	});

	const headerHeight = 2;
	const footerHeight = 3;
	const bodyHeight = Math.max(viewport.rows - headerHeight - footerHeight, 8);

	const chatBody = useMemo(
		() =>
			messages.map((msg, index) => (
				<Box
					key={`${msg.role}-${index}`}
					flexDirection="column"
					marginBottom={1}
				>
					<Text color={palette.amber}>
						{msg.role === "user" ? "USER" : "ASSIST"} ▸
					</Text>
					<Text>{msg.text}</Text>
				</Box>
			)),
		[],
	);

	return (
		<Box flexDirection="column" height={viewport.rows} paddingX={1}>
			<Box height={headerHeight} justifyContent="space-between">
				<Text color={palette.amber} bold>
					{HEADER}
				</Text>
				<Text color={palette.dim}>
					{spinner} {STATUS} · {MODEL}
				</Text>
			</Box>

			<Box height={bodyHeight} gap={1}>
				<Panel title="NAV" height={bodyHeight} width={20}>
					{navItems.map((item, index) => (
						<Text key={item} color={index === 0 ? palette.amber : palette.dim}>
							{index === 0 ? "▶" : " "} {item}
						</Text>
					))}
				</Panel>

				<Panel title="CHAT" height={bodyHeight}>
					{chatBody}
				</Panel>

				<Panel title="MODIFIED" height={bodyHeight} width={36}>
					{recentFiles.map((file) => (
						<Text key={file} color={palette.dim}>
							• {file}
						</Text>
					))}
				</Panel>
			</Box>

			<Box
				height={footerHeight}
				// borderStyle="double"
				backgroundColor={"#373b41"}
				borderColor={palette.dim}
				paddingX={1}
				justifyContent="space-between"
				alignItems="center"
			>
				<Text color={palette.dim}>Prompt ▸</Text>
				{/* <Text color={palette.amber}>
					Ask NOOA to plan the next refactor...
				</Text> */}
				<input placeholder="Ask NOOA to plan the next refactor..."></input>
				<Text color={palette.dim}>{statusLine.join("  •  ")}</Text>
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

render(<Prototype2App />);
