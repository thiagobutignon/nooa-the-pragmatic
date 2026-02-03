import { describe, expect, it } from "bun:test";


describe("sdk.run", () => {
	it("executes external steps", async () => {
		const { sdk } = await import("./index");
		const result = await sdk.run.run({
			steps: [
				{
					kind: "external",
					argv: ["echo", "ok"],
					original: "exec echo ok",
				},
			],
			captureOutput: true,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.steps[0]?.stdout?.trim()).toBe("ok");
		}
	});
});
