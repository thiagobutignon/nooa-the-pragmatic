import { AsyncLocalStorage } from "node:async_hooks";

const stdinStorage = new AsyncLocalStorage<string>();

/**
 * Safely reads stdin once and returns it as a string.
 * This prevents race conditions when multiple commands try to read from the same global stream.
 */
export async function getStdinText(): Promise<string> {
	// Check if already in storage (cached for this execution context)
	const cached = stdinStorage.getStore();
	if (cached !== undefined) {
		return cached;
	}

	// If not in TTY, read the stream
	if (!process.stdin.isTTY) {
		type StdinLike = NodeJS.ReadableStream & {
			on?: (event: string, listener: (...args: unknown[]) => void) => void;
			off?: (event: string, listener: (...args: unknown[]) => void) => void;
			[Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
		};

		const stdin = process.stdin as StdinLike;
		if (typeof stdin.on !== "function" && stdin[Symbol.asyncIterator]) {
			let data = "";
			try {
				const iterable = stdin as AsyncIterable<Uint8Array | string>;
				for await (const chunk of iterable) {
					data += chunk.toString();
				}
				const trimmed = data.trim();
				stdinStorage.enterWith(trimmed);
				return trimmed;
			} catch (_e) {
				return "";
			}
		}
		try {
			const text = await new Promise<string>((resolve) => {
				let data = "";
				let settled = false;
				const timer = setTimeout(() => {
					if (settled) return;
					settled = true;
					cleanup();
					resolve("");
				}, 200);

				const onData = (chunk: Buffer | string) => {
					data += chunk.toString();
				};
				const onEnd = () => {
					if (settled) return;
					settled = true;
					cleanup();
					resolve(data.trim());
				};
				const onError = () => {
					if (settled) return;
					settled = true;
					cleanup();
					resolve("");
				};
				const cleanup = () => {
					clearTimeout(timer);
					stdin.off?.("data", onData);
					stdin.off?.("end", onEnd);
					stdin.off?.("error", onError);
				};

				stdin.on?.("data", onData);
				stdin.on?.("end", onEnd);
				stdin.on?.("error", onError);
			});

			stdinStorage.enterWith(text);
			return text;
		} catch (_e) {
			return "";
		}
	}

	return "";
}

/**
 * Runs a function with a specific stdin context.
 * Useful for tests or when we want to inject stdin into a sub-command.
 */
export function runWithStdin<T>(text: string, fn: () => T): T {
	return stdinStorage.run(text, fn);
}
