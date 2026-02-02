import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createPrompt,
	deletePrompt,
	editPrompt,
	publishPrompt,
} from "./service";

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

test("editPrompt applies a unified diff patch to a prompt file", async () => {
	const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
	const templatesDir = join(root, "src/features/prompt/templates");
	await mkdir(templatesDir, { recursive: true });

	const initial = [
		"---",
		"name: beta",
		"version: 1.0.0",
		"description: Beta",
		"output: markdown",
		"---",
		"",
		"Hello",
		"",
	].join("\n");

	try {
		await writeFile(join(templatesDir, "beta.md"), initial);
		await editPrompt({
			templatesDir,
			name: "beta",
			patch: `@@ -8,1 +8,1 @@
-Hello
+Hello world
`,
		});

		const content = await readFile(join(templatesDir, "beta.md"), "utf8");
		expect(content).toContain("Hello world");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("deletePrompt removes a prompt file", async () => {
	const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
	const templatesDir = join(root, "src/features/prompt/templates");
	await mkdir(templatesDir, { recursive: true });

	const initial = [
		"---",
		"name: gamma",
		"version: 1.0.0",
		"---",
		"",
		"Hello",
		"",
	].join("\n");

	try {
		await writeFile(join(templatesDir, "gamma.md"), initial);
		await deletePrompt({ templatesDir, name: "gamma" });
		await expect(
			readFile(join(templatesDir, "gamma.md"), "utf8"),
		).rejects.toThrow();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("publishPrompt bumps version and appends to changelog", async () => {
	const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
	const templatesDir = join(root, "src/features/prompt/templates");
	const changelogPath = join(root, "src/features/prompt/CHANGELOG.md");
	await mkdir(templatesDir, { recursive: true });

	const initial = [
		"---",
		"name: delta",
		"version: 1.0.0",
		"description: Delta",
		"output: markdown",
		"---",
		"",
		"Hello",
		"",
	].join("\n");

	try {
		await writeFile(join(templatesDir, "delta.md"), initial);
		const next = await publishPrompt({
			templatesDir,
			name: "delta",
			level: "patch",
			changelogPath,
			note: "Initial publish",
		});

		const updated = await readFile(join(templatesDir, "delta.md"), "utf8");
		expect(updated).toContain("version: 1.0.1");
		expect(next).toBe("1.0.1");

		const changelog = await readFile(changelogPath, "utf8");
		expect(changelog).toContain("## delta");
		expect(changelog).toContain("### v1.0.1");
		expect(changelog).toContain("### v1.0.0");
		expect(changelog).toContain("- Initial publish");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
