import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.guardrail", () => {
	it("lists builtin profiles", async () => {
		const result = await sdk.guardrail.list();
		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("Expected ok result");
		}
		expect(result.data.length).toBeGreaterThan(0);
	});

	it("initializes and validates spec", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-guardrail-"));
		try {
			const initResult = await sdk.guardrail.spec.init({ cwd: root });
			expect(initResult.ok).toBe(true);
			const validateResult = await sdk.guardrail.spec.validate({ cwd: root });
			expect(validateResult.ok).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
