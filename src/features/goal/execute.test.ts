import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearGoal, getGoal, setGoal } from "./execute";

describe("Goal Manager", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "nooa-goal-"));
	});

	afterEach(async () => {
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	test("can set and get goal", async () => {
		const expectedGoal = "Ship v1.0 by Friday";
		await setGoal(expectedGoal, testDir);
		const goal = await getGoal(testDir);
		expect(goal).not.toBeNull();
		if (!goal) return;
		expect(goal).toContain(expectedGoal);
	});

	test("returns null if no goal exists", async () => {
		const goal = await getGoal(testDir);
		expect(goal).toBeNull();
	});

	test("can clear a goal", async () => {
		await setGoal("Temp goal", testDir);
		await clearGoal(testDir);
		const goal = await getGoal(testDir);
		expect(goal).toContain("# No active goal");
	});

	test("clearGoal does nothing if file doesn't exist", async () => {
		await clearGoal(testDir);
		const goal = await getGoal(testDir);
		expect(goal).toBeNull();
	});
});
