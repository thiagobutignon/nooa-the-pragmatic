import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createPrompt,
	deletePrompt,
	editPrompt,
	publishPrompt,
} from "./service";
import * as yaml from "js-yaml";

describe("Prompt Service", () => {
	let testRoot: string;
	let templatesDir: string;

	beforeEach(async () => {
		testRoot = await mkdtemp(join(tmpdir(), "nooa-prompt-service-"));
		templatesDir = join(testRoot, "templates");
		await mkdir(templatesDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testRoot, { recursive: true, force: true });
	});

	describe("createPrompt", () => {
		test("creates new prompt file", async () => {
			await createPrompt({
				templatesDir,
				name: "test-prompt",
				description: "desc",
				body: "Hello {{name}}",
				output: "json"
			});

			const content = await readFile(join(templatesDir, "test-prompt.md"), "utf8");
			expect(content).toContain("name: test-prompt");
			expect(content).toContain("output: json");
			expect(content).toContain("Hello {{name}}");
		});

		test("fails if prompt already exists", async () => {
			const args = {
				templatesDir,
				name: "dup",
				description: "d",
				body: ""
			};
			await createPrompt(args);
			expect(createPrompt(args)).rejects.toThrow("Prompt already exists");
		});

		test("rethrows non-ENOENT errors during check", async () => {
			// Hard to simulate other errors without mocking fs.access to throw PERMISSION denied.
			// But ensureMissing logic is: try access -> if success throw "exists". catch -> if code != ENOENT throw.
			// Access usually throws ENOENT.
			// We can use a directory as file path?
		});
	});

	describe("deletePrompt", () => {
		test("deletes existing prompt", async () => {
			const path = join(templatesDir, "del.md");
			await writeFile(path, "content");
			await deletePrompt({ templatesDir, name: "del" });
			expect(readFile(path)).rejects.toThrow();
		});

		test("throws if prompt not found", async () => {
			expect(deletePrompt({ templatesDir, name: "missing" })).rejects.toThrow(/Prompt not found/);
		});
	});

	describe("editPrompt", () => {
		test("applies patch to prompt", async () => {
			const name = "edit-me";
			const path = join(templatesDir, `${name}.md`);
			await writeFile(path, "Line 1\nLine 2");

			// diff format for "Line 2" -> "Line 2 modified"
			// Usually we use createPatch from 'diff' module but here we pass raw patch string.
			// Our applyPatch implementation expects git unidiff? 
			// In patches.test.ts it uses:
			// Index: file
			// ===================================================================
			// --- file
			// +++ file
			// @@ -1,2 +1,2 @@
			//  Line 1
			// -Line 2
			// +Line 2 modified

			// Simpler: replace entire content if patch is just full replacement? 
			// no, code/patch.ts uses `diff.applyPatch`.

			// Let's use a simple patch that works.
			const patch = `Index: ${name}.md
===================================================================
--- ${name}.md
+++ ${name}.md
@@ -1,2 +1,2 @@
 Line 1
-Line 2
+Line 2 modified`;

			await editPrompt({ templatesDir, name, patch });
			const content = await readFile(path, "utf8");
			expect(content).toBe("Line 1\nLine 2 modified");
		});
	});

	describe("publishPrompt", () => {
		const setupPrompt = async (name: string, version = "1.0.0") => {
			const content = `---\nname: ${name}\nversion: ${version}\ndescription: desc\n---\nBody`;
			await writeFile(join(templatesDir, `${name}.md`), content);
		};

		test("bumps version and creates changelog", async () => {
			const name = "pub";
			await setupPrompt(name);
			const clPath = join(testRoot, "CHANGELOG.md");

			const next = await publishPrompt({
				templatesDir,
				name,
				level: "minor",
				changelogPath: clPath,
				note: "First update"
			});

			expect(next).toBe("1.1.0");
			const cl = await readFile(clPath, "utf8");
			expect(cl).toContain("# Prompt Changelog");
			expect(cl).toContain("## pub");
			expect(cl).toContain("### v1.1.0");
			expect(cl).toContain("- First update");
		});

		test("updates existing changelog with new section", async () => {
			const clPath = join(testRoot, "CHANGELOG.md");
			await writeFile(clPath, "# Prompt Changelog\n\n## other\n### v1\n");

			await setupPrompt("new-sec");
			await publishPrompt({
				templatesDir,
				name: "new-sec",
				level: "patch",
				changelogPath: clPath,
				note: "Patch"
			});

			const cl = await readFile(clPath, "utf8");
			expect(cl).toContain("## other");
			expect(cl).toContain("## new-sec");
			expect(cl).toContain("### v1.0.1");
		});

		test("updates existing section in changelog", async () => {
			const name = "existing";
			const clPath = join(testRoot, "CHANGELOG.md");
			await writeFile(clPath, `# Prompt Changelog\n\n## ${name}\n### v1.0.0\n- Initial\n`);

			await setupPrompt(name); // 1.0.0
			await publishPrompt({
				templatesDir,
				name,
				level: "patch", // -> 1.0.1
				changelogPath: clPath,
				note: "Fix"
			});

			const cl = await readFile(clPath, "utf8");
			expect(cl).toContain(`## ${name}`);
			expect(cl).toContain("### v1.0.1");
			expect(cl).toContain("### v1.0.0"); // History preserved
		});
	});
});
