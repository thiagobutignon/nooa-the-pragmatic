import { describe, expect, test } from "bun:test";
import { getStdinText, runWithStdin } from "./io";

describe("IO Utilities", () => {
	test("runWithStdin provides mock constant content", async () => {
		const result = runWithStdin("hello", () => {
			return getStdinText();
		});
		expect(await result).toBe("hello");
	});

	test("getStdinText returns empty string when TTY", async () => {
		// Ensure it's TTY
		// @ts-expect-error
		process.stdin.isTTY = true;
		const result = await getStdinText();
		expect(result).toBe("");
	});

	test("getStdinText reads from non-TTY stream async iterator", async () => {
		// @ts-expect-error
		process.stdin.isTTY = false;
		const originalStdin = process.stdin;

		const mockData = [Buffer.from("chunk1"), "chunk2"];
		const mockStdin = {
			isTTY: false,
			[Symbol.asyncIterator]: async function* () {
				for (const chunk of mockData) yield chunk;
			},
		};

		// @ts-expect-error
		process.stdin = mockStdin;
		const result = await getStdinText();
		expect(result).toBe("chunk1chunk2");

		// Restore
		process.stdin = originalStdin;
	});

	test("getStdinText handles async iterator error", async () => {
		// @ts-expect-error
		process.stdin.isTTY = false;
		const originalStdin = process.stdin;

		const mockStdin = {
			isTTY: false,
			[Symbol.asyncIterator]: async function* () {
				yield ""; // Fix: Generator must contain yield
				throw new Error("fail");
			},
		};

		// @ts-expect-error
		process.stdin = mockStdin;
		const result = await getStdinText();
		expect(result).toBe("");

		process.stdin = originalStdin;
	});

	test("getStdinText handles stream events", async () => {
		// @ts-expect-error
		process.stdin.isTTY = false;
		const originalStdin = process.stdin;

		const handlers: any = {};
		const mockStdin = {
			isTTY: false,
			on: (event: string, cb: any) => {
				handlers[event] = cb;
			},
			off: () => {},
		};

		// @ts-expect-error
		process.stdin = mockStdin;

		const promise = getStdinText();

		// Wait a bit for the internal promise setup
		await new Promise((r) => setTimeout(r, 0));

		// Simulate data and end
		handlers.data?.(Buffer.from("hello "));
		handlers.data?.("world");
		handlers.end?.();

		const result = await promise;
		expect(result).toBe("hello world");

		process.stdin = originalStdin;
	});

	test("getStdinText handles stream timeout", async () => {
		// @ts-expect-error
		process.stdin.isTTY = false;
		const originalStdin = process.stdin;

		const mockStdin = {
			isTTY: false,
			on: () => {}, // do nothing to trigger timeout
			off: () => {},
		};

		// @ts-expect-error
		process.stdin = mockStdin;

		const result = await getStdinText();
		expect(result).toBe("");

		process.stdin = originalStdin;
	});

	test("getStdinText handles stream error", async () => {
		// @ts-expect-error
		process.stdin.isTTY = false;
		const originalStdin = process.stdin;

		const handlers: any = {};
		const mockStdin = {
			isTTY: false,
			on: (event: string, cb: any) => {
				handlers[event] = cb;
			},
			off: () => {},
		};

		// @ts-expect-error
		process.stdin = mockStdin;

		const promise = getStdinText();

		// Wait for internal promise setup
		await new Promise((r) => setTimeout(r, 0));

		handlers.error?.(new Error("fail"));

		const result = await promise;
		expect(result).toBe("");

		process.stdin = originalStdin;
	});
});
