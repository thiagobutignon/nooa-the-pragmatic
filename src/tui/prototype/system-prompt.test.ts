import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "./system-prompt";

const manifest = {
	generated: "2026-02-06T00:00:00.000Z",
	version: "1.0.0",
	features: [
		{
			name: "read",
			description: "Read file contents",
			agentDoc:
				"<instruction><usage><cli>nooa read &lt;path&gt;</cli></usage></instruction>",
		},
		{
			name: "pwd",
			description: "Print current working directory",
			agentDoc: "<instruction><usage><cli>nooa pwd</cli></usage></instruction>",
		},
	],
};

describe("buildSystemPrompt", () => {
	test("includes tool list with cli usage", async () => {
		const prompt = await buildSystemPrompt(manifest);
		expect(prompt).toContain("You have access to the following CLI tools:");
		expect(prompt).toContain("read");
		expect(prompt).toContain("nooa read <path>");
		expect(prompt).toContain("pwd");
		expect(prompt).toContain("nooa pwd");
	});

	test("respects maxTools", async () => {
		const prompt = await buildSystemPrompt(manifest, { maxTools: 1 });
		expect(prompt).toContain("read");
		expect(prompt).not.toContain("pwd");
	});
});
