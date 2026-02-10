import { describe, expect, test } from "bun:test";
import { EvalEngine } from "./engine";

process.env.NOOA_EMBED_PROVIDER = "mock";

describe("EvalEngine", () => {
	test("builds system prompt with assembler and template", async () => {
		const engine = new EvalEngine();
		const prompt = await engine.buildSystemPrompt({
			promptName: "review",
			inputText: "Check this file",
			vars: {},
			root: process.cwd(),
		});

		expect(prompt).toContain("# CONSTITUTION");
		expect(prompt).toContain("NOOA Instant Code Reviewer");
	});
});
