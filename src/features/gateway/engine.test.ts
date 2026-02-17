import { describe, expect, mock, test } from "bun:test";
import { run } from "./engine";

describe("gateway engine", () => {
	test("returns status payload", async () => {
		const result = await run({ action: "status" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.mode).toBe("status");
			expect(result.data.running).toBe(false);
		}
	});

	test("runs once and processes one message", async () => {
		const runner = mock(async () => ({ forLlm: "ok-response" }));
		const result = await run({
			action: "start",
			once: true,
			message: "hello",
			runner,
		});

		expect(result.ok).toBe(true);
		expect(runner).toHaveBeenCalledTimes(1);
		if (result.ok) {
			expect(result.data.mode).toBe("start");
			expect(result.data.lastResponse).toContain("ok-response");
			expect(result.data.channels).toContain("cli");
		}
	});

	test("uses default runner factory when runner is not provided", async () => {
		const factory = mock(async () =>
			mock(async () => ({ forLlm: "factory-ok" })),
		);
		const result = await run({
			action: "start",
			once: true,
			message: "hello",
			defaultRunnerFactory: factory,
		});
		expect(result.ok).toBe(true);
		expect(factory).toHaveBeenCalledTimes(1);
		if (result.ok) {
			expect(result.data.lastResponse).toContain("factory-ok");
		}
	});

	test("returns error for long-running mode while disabled", async () => {
		const runner = mock(async () => ({ forLlm: "ok" }));
		const result = await run({ action: "start", once: false, runner });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("gateway.long_running_not_supported");
		}
	});
});
