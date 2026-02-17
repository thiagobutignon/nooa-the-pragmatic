import { describe, expect, test } from "bun:test";
import { gatewayMeta, run } from "./cli";

describe("gateway feature", () => {
	test("status action succeeds", async () => {
		const result = await run({ action: "status" });
		expect(result.ok).toBe(true);
	});

	test("metadata exposes gateway command", () => {
		expect(gatewayMeta.name).toBe("gateway");
		expect(gatewayMeta.description.length).toBeGreaterThan(0);
	});
});
