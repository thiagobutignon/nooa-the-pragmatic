import { describe, expect, it } from "bun:test";
import { execa } from "execa";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa commit", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "commit", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa commit -m");
		expect(res.stdout).toContain("--no-test");
	});

	it("blocks TODO markers by default", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-commit-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await writeFile(join(root, "todo.txt"), "TODO: fix me\n");
			await execa("git", ["add", "."], { cwd: root });
			await execa(
				"git",
				[
					"-c",
					"user.email=test@example.com",
					"-c",
					"user.name=test",
					"commit",
					"-m",
					"init",
					"--allow-empty",
				],
				{ cwd: root },
			);
			await writeFile(join(root, "todo.txt"), "TODO: fix me again\n");
			await execa("git", ["add", "."], { cwd: root });

			const res = await execa(
				"bun",
				[binPath, "commit", "-m", "test commit"],
				{ cwd: root, reject: false },
			);

			expect(res.exitCode).toBe(2);
			expect(res.stderr).toContain("violation found");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("runs tests by default", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-commit-"));
		try {
			await execa("git", ["init"], { cwd: root });
			await execa("git", ["branch", "-m", "main"], { cwd: root });
			await writeFile(
				join(root, "package.json"),
				JSON.stringify({ name: "tmp", version: "0.0.0" }),
			);
			await writeFile(
				join(root, "example.test.ts"),
				`import { writeFileSync } from "node:fs";
import { test, expect } from "bun:test";

test("marker", () => {
\twriteFileSync("test-ran.txt", "ok");
\texpect(true).toBe(true);
});
`,
			);
			await writeFile(join(root, "file.txt"), "hello\n");
			await execa("git", ["add", "."], { cwd: root });
			await execa(
				"git",
				[
					"-c",
					"user.email=test@example.com",
					"-c",
					"user.name=test",
					"commit",
					"-m",
					"init",
					"--allow-empty",
				],
				{ cwd: root },
			);

			await writeFile(join(root, "file.txt"), "hello again\n");
			await execa("git", ["add", "."], { cwd: root });

			const res = await execa(
				"bun",
				[binPath, "commit", "-m", "commit with tests"],
				{ cwd: root, reject: false },
			);

			expect(res.exitCode).toBe(0);
			const ran = await execa("git", ["rev-parse", "HEAD"], { cwd: root });
			expect(ran.exitCode).toBe(0);
			const marker = await execa("test", ["-f", join(root, "test-ran.txt")], {
				reject: false,
			});
			expect(marker.exitCode).toBe(0);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
