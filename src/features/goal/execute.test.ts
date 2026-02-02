import { expect, test, describe, beforeEach } from "bun:test";
import { setGoal, getGoal } from "./execute";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Goal Manager", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), "nooa-goal-"));
        await mkdir(join(testDir, ".nooa"), { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    test("can set and get goal", async () => {
        await setGoal("Ship v1.0 by Friday", testDir);
        const goal = await getGoal(testDir);
        expect(goal).toContain("Ship v1.0 by Friday");
    });
});

import { mkdtemp } from "node:fs/promises";
import { afterEach } from "bun:test";
