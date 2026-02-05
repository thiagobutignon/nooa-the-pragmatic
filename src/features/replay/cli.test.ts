import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { run } from "./cli";

const tmpRoot = join(import.meta.dir, "tmp-replay");

describe("replay.run", () => {
  test("fails when action is missing", async () => {
    const result = await run({ action: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("replay.missing_action");
    }
  });

  test("add creates a node", async () => {
    await rm(tmpRoot, { recursive: true, force: true });
    await mkdir(join(tmpRoot, ".nooa"), { recursive: true });

    const result = await run({
      action: "add",
      label: "A",
      root: tmpRoot,
    });

    expect(result.ok).toBe(true);
    const raw = await readFile(join(tmpRoot, ".nooa/replay.json"), "utf-8");
    const data = JSON.parse(raw) as { nodes: { label: string }[] };
    expect(data.nodes.length).toBe(1);
    expect(data.nodes[0].label).toBe("A");
  });
});
