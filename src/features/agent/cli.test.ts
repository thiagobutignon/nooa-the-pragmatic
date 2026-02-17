import { describe, expect, it } from "bun:test";

describe("Agent CLI", () => {
	it("exports a command with name 'agent'", async () => {
		const mod = await import("./cli");
		expect(mod.default.name).toBe("agent");
	});

	it("has help text mentioning agentic loop", async () => {
		const mod = await import("./cli");
		expect(mod.agentHelp.toLowerCase()).toContain("agent");
		expect(mod.agentHelp.toLowerCase()).toContain("loop");
	});
});
