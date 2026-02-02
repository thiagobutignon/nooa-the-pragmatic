import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initIdentity } from "./init";

describe("Identity Initialization", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "nooa-identity-"));
	});

	afterEach(async () => {
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	test("initIdentity creates necessary files", async () => {
		await initIdentity(testDir);

		const identityPath = join(testDir, ".nooa", "IDENTITY.md");
		const soulPath = join(testDir, ".nooa", "SOUL.md");
		const userPath = join(testDir, ".nooa", "USER.md");

		const identityFile = Bun.file(identityPath);
		const soulFile = Bun.file(soulPath);
		const userFile = Bun.file(userPath);

		expect(await identityFile.exists()).toBe(true);
		expect(await soulFile.exists()).toBe(true);
		expect(await userFile.exists()).toBe(true);

		const identityContent = await identityFile.text();
		expect(identityContent).toContain("**Name**: NOOA");
	});

	test("initIdentity does not overwrite existing files by default", async () => {
		await initIdentity(testDir);

		const identityPath = join(testDir, ".nooa", "IDENTITY.md");
		await Bun.write(identityPath, "Modified Content");

		// Run init again
		await initIdentity(testDir);

		const content = await Bun.file(identityPath).text();
		expect(content).toBe("Modified Content");
	});
});
