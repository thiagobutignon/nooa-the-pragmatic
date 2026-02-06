export type AiInvocationOptions = {
	stream?: boolean;
	provider?: string;
	model?: string;
	cwd?: string;
};

export type AiInvocation = {
	cmd: string;
	args: string[];
	cwd: string;
};

export type StreamHandlers = {
	onStdout?: (chunk: string) => void;
	onStderr?: (chunk: string) => void;
	onExit?: (code: number) => void;
};

export function buildAiInvocation(
	prompt: string,
	options: AiInvocationOptions = {},
): AiInvocation {
	const args = ["index.ts", "ai", prompt];

	if (options.provider) {
		args.push("--provider", options.provider);
	}
	if (options.model) {
		args.push("--model", options.model);
	}
	if (options.stream) {
		args.push("--stream");
	}

	return {
		cmd: process.execPath,
		args,
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

export function runAiStream(
	prompt: string,
	options: AiInvocationOptions,
	handlers: StreamHandlers = {},
) {
	const invocation = buildAiInvocation(prompt, {
		...options,
		stream: true,
	});

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
