import { test, expect } from "bun:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPrompt } from "./service";

test("createPrompt writes a new prompt file with frontmatter and body", async () => {
	const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
	const templatesDir = join(root, "src/features/prompt/templates");
	await mkdir(templatesDir, { recursive: true });

	try {
		await createPrompt({
			templatesDir,
			name: "alpha",
			description: "Alpha",
			output: "markdown",
			body: "Hello {{world}}",
		});

		const content = await readFile(join(templatesDir, "alpha.md"), "utf8");
		expect(content).toContain("name: alpha");
		expect(content).toContain("version: 1.0.0");
		expect(content).toContain("description: Alpha");
		expect(content).toContain("output: markdown");
		expect(content).toContain("Hello {{world}}");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
