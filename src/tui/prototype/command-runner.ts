export type CommandInvocation = {
	cmd: string;
	args: string[];
	cwd: string;
};

export type CommandHandlers = {
	onStdout?: (chunk: string) => void;
	onStderr?: (chunk: string) => void;
	onExit?: (code: number) => void;
};

export function buildNooaInvocation(
	command: string,
	options: { cwd?: string } = {},
): CommandInvocation {
	const trimmed = command.trim();
	const parts = trimmed.split(/\s+/);
	return {
		cmd: process.execPath,
		args: ["index.ts", ...parts],
		cwd: options.cwd ?? process.cwd(),
	};
}

async function readStream(
	stream: ReadableStream<Uint8Array> | null,
	onChunk?: (chunk: string) => void,
) {
	if (!stream || !onChunk) return;
	const decoder = new TextDecoder();
	for await (const chunk of stream) {
		onChunk(decoder.decode(chunk));
	}
}

export function runNooaCommand(
	command: string,
	options: { cwd?: string } = {},
	handlers: CommandHandlers = {},
) {
	const invocation = buildNooaInvocation(command, options);
	const child = Bun.spawn({
		cmd: [invocation.cmd, ...invocation.args],
		cwd: invocation.cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	void readStream(child.stdout, handlers.onStdout);
	void readStream(child.stderr, handlers.onStderr);

	const exited = child.exited.then((code) => {
		handlers.onExit?.(code);
		return code;
	});

	return {
		process: child,
		exited,
		stop: () => child.kill(),
	};
}
