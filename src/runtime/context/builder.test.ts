import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolRegistry } from "../tool-registry";
import { toolResult } from "../types";
import { ContextBuilder } from "./builder";

describe("ContextBuilder", () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "nooa-ctx-"));
		await mkdir(join(workspace, ".nooa"), { recursive: true });
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it("builds system prompt from identity files", async () => {
		await writeFile(
			join(workspace, ".nooa", "SOUL.md"),
			"Sou pragmático e direto.",
		);
		await writeFile(
			join(workspace, ".nooa", "USER.md"),
			"Timezone: BRT. Lingua: pt-BR.",
		);

		const builder = new ContextBuilder(workspace, new ToolRegistry());
		const prompt = await builder.buildSystemPrompt();

		expect(prompt).toContain("Sou pragmático e direto.");
		expect(prompt).toContain("Timezone: BRT");
	});

	it("includes tool definitions in prompt", async () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "read_file",
			description: "Read a file from disk",
			parameters: { path: { type: "string", required: true } },
			execute: async () => toolResult("content"),
		});

		const builder = new ContextBuilder(workspace, registry);
		const prompt = await builder.buildSystemPrompt();

		expect(prompt).toContain("read_file");
		expect(prompt).toContain("Read a file from disk");
	});

	it("includes summary if provided", async () => {
		const builder = new ContextBuilder(workspace, new ToolRegistry());
		const prompt = await builder.buildSystemPrompt("User prefers TypeScript.");
		expect(prompt).toContain("User prefers TypeScript.");
	});

	it("builds full messages array", async () => {
		const builder = new ContextBuilder(workspace, new ToolRegistry());
		const messages = await builder.buildMessages(
			[{ role: "user", content: "hello" }],
			"what is 2+2?",
			undefined,
		);

		expect(messages[0]?.role).toBe("system");
		expect(messages[messages.length - 1]?.content).toBe("what is 2+2?");
	});
});
