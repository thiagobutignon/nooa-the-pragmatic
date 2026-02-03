import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.prompt", () => {
	it("creates and publishes a prompt", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-prompt-sdk-"));
		const templatesDir = join(root, "templates");
		const changelogPath = join(root, "CHANGELOG.md");
		try {
			const { sdk } = await import("./index");
			const createResult = await sdk.prompt.create({
				templatesDir,
				name: "alpha",
				description: "Alpha",
				body: "Hello",
			});
			expect(createResult.ok).toBe(true);

			const publishResult = await sdk.prompt.publish({
				templatesDir,
				name: "alpha",
				level: "patch",
				note: "Initial publish",
				changelogPath,
			});
			expect(publishResult.ok).toBe(true);
			if (!publishResult.ok) {
				throw new Error("Expected ok publish result");
			}
			expect(publishResult.data.version).toBe("1.0.1");

			const content = await readFile(join(templatesDir, "alpha.md"), "utf8");
			expect(content).toContain("Hello");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
