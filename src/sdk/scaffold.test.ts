import { describe, expect, it } from "bun:test";


describe("sdk.scaffold", () => {
	it("plans scaffold output in dry run", async () => {
		const { sdk } = await import("./index");
		const result = await sdk.scaffold.run({
			type: "command",
			name: "sdk-scaffold-test",
			dryRun: true,
			withDocs: true,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.files.length).toBeGreaterThan(0);
			const hasDocs = result.data.files.some((path) =>
				path.includes("docs/commands"),
			);
			expect(hasDocs).toBe(true);
		}
	});
});
