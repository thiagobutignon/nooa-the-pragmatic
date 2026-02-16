import { describe, expect, it } from "bun:test";
import { embedText, resolveProvider } from "./engine";

process.env.NOOA_EMBED_PROVIDER = "mock";

describe("embed engine", () => {
	it("selects mock provider", async () => {
		const provider = resolveProvider({ provider: "mock" });
		expect(provider.name).toBe("mock");
	});

	it("returns deterministic embedding from mock", async () => {
		process.env.NOOA_EMBED_PROVIDER = "mock";
		const result = await embedText("hello", {
			provider: "mock",
			model: "mock",
		});
		console.log("Embed result length:", result.embedding.length);
		console.log("Embed result provider:", result.provider);
		expect(result.embedding.length).toBe(8);
		expect(result.dimensions).toBe(8);
	});
});
