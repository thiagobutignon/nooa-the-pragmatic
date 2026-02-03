import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../core/logger";
import { PromptEngine } from "./engine";
import { InjectionEngine } from "./injection";

describe("PromptEngine", () => {
	let testDir: string;
	let engine: PromptEngine;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "nooa-prompt-engine-"));
		engine = new PromptEngine(testDir);
	});

	afterEach(async () => {
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	test("listPrompts returns valid prompts", async () => {
		await writeFile(
			join(testDir, "valid.md"),
			"---\nname: valid\nversion: 1.0.0\ndescription: test\n---\nbody",
		);
		await writeFile(join(testDir, "invalid.txt"), "ignored");

		const prompts = await engine.listPrompts();
		expect(prompts).toHaveLength(1);
		expect(prompts[0].name).toBe("valid");
	});

	test("listPrompts handles errors gracefully", async () => {
		await writeFile(join(testDir, "bad.md"), "invalid content");
		const logSpy = spyOn(logger, "error").mockImplementation(() => {});

		const prompts = await engine.listPrompts();
		expect(prompts).toHaveLength(0);
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	test("loadPrompt parses correctly", async () => {
		const content =
			"---\nname: p1\nversion: 1.0.0\ndescription: d1\n---\nHello {{name}}";
		await writeFile(join(testDir, "p1.md"), content);

		const prompt = await engine.loadPrompt("p1");
		expect(prompt.metadata.name).toBe("p1");
		expect(prompt.body).toBe("Hello {{name}}");
	});

	test("parsePrompt throws on missing frontmatter", () => {
		expect(() => engine.parsePrompt("no frontmatter")).toThrow(
			"Invalid prompt format",
		);
	});

	test("parsePrompt throws on invalid metadata", () => {
		const content = "---\nname: t\n---\nbody";
		expect(() => engine.parsePrompt(content)).toThrow(
			"Invalid prompt metadata",
		);
	});

	test("renderPrompt substitutes variables", async () => {
		const prompt = {
			metadata: { name: "t", version: "1", description: "d" },
			body: "Hello {{name}}",
		};
		const result = await engine.renderPrompt(
			prompt,
			{ name: "World" },
			{ skipAgentContext: true },
		);
		expect(result).toBe("Hello World");
	});

	test("renderPrompt includes agent context", async () => {
		const spy = spyOn(
			InjectionEngine.prototype,
			"getInjectedContext",
		).mockResolvedValue({
			content: "System Context",
			injectedFiles: [],
		});

		const prompt = {
			metadata: { name: "t", version: "1", description: "d" },
			body: "User Request",
		};

		const result = await engine.renderPrompt(prompt, {});
		expect(result).toContain("System Context");
		expect(result).toContain("User Request");

		spy.mockRestore();
	});

	test("renderPrompt includes injected context", async () => {
		const prompt = {
			metadata: { name: "t", version: "1", description: "d" },
			body: "Body",
		};
		const result = await engine.renderPrompt(
			prompt,
			{},
			{ injectedContext: "Injected", skipAgentContext: true },
		);
		expect(result).toContain("Injected");
		expect(result).toContain("Body");
	});

	test("bumpVersion increments version correctly", async () => {
		const content = "---\nname: v\nversion: 1.2.3\ndescription: d\n---\nbody";
		await writeFile(join(testDir, "v.md"), content);

		expect(await engine.bumpVersion("v", "patch")).toBe("1.2.4");
		expect(await engine.bumpVersion("v", "minor")).toBe("1.3.0");
		expect(await engine.bumpVersion("v", "major")).toBe("2.0.0");
	});

	test("bumpVersion throws on invalid version", async () => {
		const content = "---\nname: v\nversion: 1.a.3\ndescription: d\n---\nbody";
		await writeFile(join(testDir, "bad.md"), content);
		await expect(engine.bumpVersion("bad", "patch")).rejects.toThrow(
			"Invalid version format",
		);
	});
});
