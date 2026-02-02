import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { execa } from "execa";
import { join } from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";
import { setGoal } from "./execute";

describe("Goal CLI", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), "nooa-goal-cli-"));
        await mkdir(join(testDir, ".nooa"), { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    test("goal --help shows usage", async () => {
        const { stdout } = await execa(bunPath, ["index.ts", "goal", "--help"], {
            cwd: repoRoot,
            env: baseEnv,
            reject: false
        });
        expect(stdout).toContain("Usage: nooa goal");
    });

    test("goal status --json outputs structured data", async () => {
        await setGoal("Test goal", testDir);

        // We run index.ts from repoRoot but set cwd to testDir so prompt command picks up local .nooa
        // Note: we need to point to index.ts absolutely
        const { stdout } = await execa(bunPath, [join(repoRoot, "index.ts"), "goal", "status", "--json"], {
            cwd: testDir,
            env: baseEnv,
        });

        const result = JSON.parse(stdout);
        expect(result.goal).toContain("Test goal");
    });
});
