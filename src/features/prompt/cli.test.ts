import { test, expect } from "bun:test";
import { execa } from "execa";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const binPath = join(process.cwd(), "index.ts");

async function setupPromptRoot() {
	const root = await mkdtemp(join(tmpdir(), "nooa-prompt-cli-"));
	const templatesDir = join(root, "src/features/prompt/templates");
	await mkdir(templatesDir, { recursive: true });
	return { root, templatesDir };
}

test("nooa prompt --help lists new subcommands", async () => {
	const res = await execa("bun", [binPath, "prompt", "--help"], { reject: false });
	expect(res.exitCode).toBe(0);
	expect(res.stdout).toContain("create");
	expect(res.stdout).toContain("edit");
	expect(res.stdout).toContain("delete");
	expect(res.stdout).toContain("publish");
});

test("nooa prompt create writes a new prompt", async () => {
	const { root, templatesDir } = await setupPromptRoot();
	try {
		const res = await execa(
			"bun",
			[binPath, "prompt", "create", "alpha", "--description", "Alpha", "--body", "Hello"],
			{ cwd: root, reject: false },
		);
		expect(res.exitCode).toBe(0);
		const content = await readFile(join(templatesDir, "alpha.md"), "utf8");
		expect(content).toContain("name: alpha");
		expect(content).toContain("version: 1.0.0");
		expect(content).toContain("Hello");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("nooa prompt edit applies patch from stdin", async () => {
	const { root, templatesDir } = await setupPromptRoot();
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
		const patch = "@@ -8,1 +8,1 @@\n-Hello\n+Hello world\n";
		const res = await execa(
			"bun",
			[binPath, "prompt", "edit", "beta", "--patch"],
			{ cwd: root, reject: false, input: patch },
		);
		expect(res.exitCode).toBe(0);
		const updated = await readFile(join(templatesDir, "beta.md"), "utf8");
		expect(updated).toContain("Hello world");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("nooa prompt delete removes prompt file", async () => {
	const { root, templatesDir } = await setupPromptRoot();
	const initial = "---\nname: gamma\nversion: 1.0.0\n---\n\nHello\n";

	try {
		await writeFile(join(templatesDir, "gamma.md"), initial);
		const res = await execa("bun", [binPath, "prompt", "delete", "gamma"], {
			cwd: root,
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		await expect(readFile(join(templatesDir, "gamma.md"), "utf8")).rejects.toThrow();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("nooa prompt publish bumps version and updates changelog", async () => {
	const { root, templatesDir } = await setupPromptRoot();
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
		const res = await execa(
			"bun",
			[binPath, "prompt", "publish", "delta", "--level", "patch", "--note", "Initial publish"],
			{ cwd: root, reject: false },
		);
		expect(res.exitCode).toBe(0);
		const updated = await readFile(join(templatesDir, "delta.md"), "utf8");
		expect(updated).toContain("version: 1.0.1");
		const changelog = await readFile(join(root, "src/features/prompt/CHANGELOG.md"), "utf8");
		expect(changelog).toContain("### v1.0.1");
		expect(changelog).toContain("### v1.0.0");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
