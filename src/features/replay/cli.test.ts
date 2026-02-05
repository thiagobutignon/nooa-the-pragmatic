import { describe, expect, test } from "bun:test";
import { run } from "./cli";

describe("replay.run", () => {
  test("fails when action is missing", async () => {
    const result = await run({ action: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("replay.missing_action");
    }
  });
});
