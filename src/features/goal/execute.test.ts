import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { setGoal, getGoal } from "./execute";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
        expect(goal!).toContain(expectedGoal);
    });
});
