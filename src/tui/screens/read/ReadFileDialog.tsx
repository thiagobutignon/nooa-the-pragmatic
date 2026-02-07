import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { useMemo, useState } from "react";
import { usePwd } from "../../hooks/usePwd";
import { useRead } from "../../hooks/useRead";

const HEADER = "NOOA HYPERGROWTH READ";
const TAGLINE = "Fast file inspection with agent-grade output.";
const MAX_LINES = 18;
const SEPARATOR = "-".repeat(60);

function formatPreview(content: string): string[] {
	const lines = content.split(/\r?\n/);
	if (lines.length <= MAX_LINES) {
		return lines;
	}
	return [...lines.slice(0, MAX_LINES), "..."];
}

function StatusBadge({ status }: { status: string }) {
	if (status === "loading") return <Text color="yellow">loading</Text>;
	if (status === "success") return <Text color="green">ready</Text>;
	if (status === "error") return <Text color="red">error</Text>;
	return <Text color="gray">idle</Text>;
}

export function ReadFileDialog({ initialPath = "" }: { initialPath?: string }) {
	const { exit } = useApp();
	const pwdState = usePwd();
	const basePath = pwdState.cwd ?? process.cwd();
	const { state, read, reset } = useRead(basePath);
	const [path, setPath] = useState(initialPath);

	useInput((input, key) => {
		if (input === "q" || key.escape) {
			exit();
		}
		if (input === "r") {
			reset();
		}
	});

	const previewLines = useMemo(() => {
		if (!state.data?.content) return [];
		return formatPreview(state.data.content);
	}, [state.data?.content]);

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Text color="cyan" bold>
				{HEADER}
			</Text>
			<Text dimColor>{TAGLINE}</Text>
			<Text dimColor>{`cwd: ${basePath}`}</Text>
			<Text dimColor>{SEPARATOR}</Text>

			<Box flexDirection="column" marginTop={1}>
				<Text>
					Path <Text dimColor>(enter to read)</Text>
				</Text>
				<Text dimColor>Resolved relative to cwd unless absolute.</Text>
				<TextInput
					value={path}
					onChange={setPath}
					placeholder="src/index.ts"
					onSubmit={(value) => read({ path: value })}
				/>
			</Box>

			<Box marginTop={1} flexDirection="row">
				<Text>
					Status: <StatusBadge status={state.status} />
				</Text>
				<Text dimColor> | </Text>
				<Text dimColor>r: reset</Text>
				<Text dimColor> | </Text>
				<Text dimColor>q: quit</Text>
			</Box>

			<Text dimColor>{SEPARATOR}</Text>

			<Box flexDirection="column">
				<Text color="magenta">Output preview</Text>
				{state.status === "error" && (
					<Box flexDirection="column">
						<Text color="red">
							{state.error?.message ?? "Failed to read file."}
						</Text>
						{state.triedPaths && state.triedPaths.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								<Text dimColor>Paths tried (cwd-scoped):</Text>
								{state.triedPaths.map((candidate) => (
									<Text key={candidate} dimColor>
										{candidate}
									</Text>
								))}
							</Box>
						)}
					</Box>
				)}
				{state.status !== "error" && previewLines.length === 0 && (
					<Text dimColor>No content yet.</Text>
				)}
				{previewLines.map((line, index) => (
					<Text key={String(index)}>{line}</Text>
				))}
			</Box>
		</Box>
	);
}
