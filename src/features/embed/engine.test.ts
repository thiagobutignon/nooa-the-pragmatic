import { describe, it, expect } from "bun:test";
import { embedText, resolveProvider } from "./engine";

process.env.NOOA_EMBED_PROVIDER = "mock";

describe("embed engine", () => {
	it("selects mock provider", async () => {
		const provider = resolveProvider({ provider: "mock" });
		expect(provider.name).toBe("mock");
	});

	it("returns deterministic embedding from mock", async () => {
		const result = await embedText("hello", {
			provider: "mock",
			model: "mock",
		});
		expect(result.embedding.length).toBe(8);
		expect(result.dimensions).toBe(8);
	});
});
