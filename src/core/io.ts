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
		try {
			const text = await new Response(process.stdin as any).text();
			return text.trim();
		} catch (e) {
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
