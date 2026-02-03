import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.goal", () => {
	it("sets and gets goal", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-goal-"));
		try {
			const setResult = await sdk.goal.set({ goal: "Ship SDK", cwd: root });
			expect(setResult.ok).toBe(true);
			const getResult = await sdk.goal.get({ cwd: root });
			expect(getResult.ok).toBe(true);
			if (!getResult.ok) {
				throw new Error("Expected ok result");
			}
			expect(getResult.data).toContain("Ship SDK");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
