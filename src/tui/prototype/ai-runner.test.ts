import { describe, expect, test } from "bun:test";
import { buildAiInvocation } from "./ai-runner";

describe("buildAiInvocation", () => {
	test("includes script, subcommand, prompt, and stream flag", () => {
		const prompt = "Explain TDD";
		const invocation = buildAiInvocation(prompt, { stream: true });
		expect(invocation.cmd).toBe(process.execPath);
		expect(invocation.args[0]).toBe("index.ts");
		expect(invocation.args[1]).toBe("ai");
		expect(invocation.args[2]).toBe(prompt);
		expect(invocation.args).toContain("--stream");
	});

	test("supports provider and model when defined", () => {
		const invocation = buildAiInvocation("Hi", {
			provider: "ollama",
			model: "codex",
		});
		expect(invocation.args).toContain("--provider");
		expect(invocation.args).toContain("ollama");
		expect(invocation.args).toContain("--model");
		expect(invocation.args).toContain("codex");
	});
});
