import { afterEach, describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const run = (args: string[], input?: string) =>
	execa(bunPath, ["index.ts", ...args], {
		reject: false,
		input,
		env: baseEnv,
		cwd: repoRoot,
	});

const OUT = "tmp-patch.txt";

afterEach(async () => {
	await rm(OUT, { force: true });
});

describe("nooa code write --patch", () => {
	test("--help includes patch flags", async () => {
		const res = await run(["code", "write", "--help"]);
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("--patch");
		expect(res.stdout).toContain("--patch-from");
		expect(res.stdout).toContain(
			"--patch/--patch-from cannot be combined with --from",
		);
	});

	test("applies patch from stdin", async () => {
		await writeFile(OUT, "line1\nline2\nline3\n");
		const patch = `--- a/tmp-patch.txt\n+++ b/tmp-patch.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2-updated\n line3\n`;
		const res = await run(["code", "write", OUT, "--patch"], patch);
		expect(res.exitCode).toBe(0);
		const text = await readFile(OUT, "utf-8");
		expect(text).toBe("line1\nline2-updated\nline3\n");
	});
});
