import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "../session/manager";
import { ToolRegistry } from "../tool-registry";
import { toolResult } from "../types";
import { AgentLoop } from "./loop";

describe("AgentLoop", () => {
	let sessionStorage: string;

	beforeEach(async () => {
		sessionStorage = await mkdtemp(join(tmpdir(), "nooa-loop-session-"));
	});

	afterEach(async () => {
		await rm(sessionStorage, { recursive: true, force: true });
	});

	it("processes a simple message without tool calls", async () => {
		const provider = {
			generate: mock(async () => ({
				content: "Hello! I'm NOOA.",
				toolCalls: [],
			})),
		};

		const loop = new AgentLoop({
			provider,
			tools: new ToolRegistry(),
			sessions: new SessionManager(sessionStorage),
			workspace: "/tmp/nooa",
			maxIterations: 5,
		});

		const result = await loop.processMessage("cli:direct", "Hello");

		expect(result.isError).toBe(false);
		expect(result.forLlm).toContain("Hello! I'm NOOA.");
		expect(provider.generate).toHaveBeenCalledTimes(1);
	});

	it("executes tool calls and iterates until assistant final answer", async () => {
		let calls = 0;
		const provider = {
			generate: mock(async () => {
				calls += 1;
				if (calls === 1) {
					return {
						content: "",
						toolCalls: [
							{ id: "call_1", name: "echo", arguments: { text: "x" } },
						],
					};
				}
				return {
					content: "Done! Echo returned x",
					toolCalls: [],
				};
			}),
		};

		const registry = new ToolRegistry();
		registry.register({
			name: "echo",
			description: "Echo text",
			parameters: { text: { type: "string", required: true } },
			execute: async (args) => toolResult(`Echo: ${String(args.text ?? "")}`),
		});

		const loop = new AgentLoop({
			provider,
			tools: registry,
			sessions: new SessionManager(sessionStorage),
			workspace: "/tmp/nooa",
			maxIterations: 5,
		});

		const result = await loop.processMessage("cli:direct", "echo x");

		expect(result.isError).toBe(false);
		expect(result.forLlm).toContain("Done!");
		expect(provider.generate).toHaveBeenCalledTimes(2);
	});

	it("stops with error after max iterations", async () => {
		const provider = {
			generate: mock(async () => ({
				content: "",
				toolCalls: [{ id: "call_inf", name: "loop_forever", arguments: {} }],
			})),
		};

		const registry = new ToolRegistry();
		registry.register({
			name: "loop_forever",
			description: "Always requests another call",
			parameters: {},
			execute: async () => toolResult("again"),
		});

		const loop = new AgentLoop({
			provider,
			tools: registry,
			sessions: new SessionManager(sessionStorage),
			workspace: "/tmp/nooa",
			maxIterations: 3,
		});

		const result = await loop.processMessage("cli:direct", "loop");
		expect(result.isError).toBe(true);
		expect(result.forLlm.toLowerCase()).toContain("max");
	});

	it("registers built-in spawn and subagent tools", async () => {
		const provider = {
			generate: mock(async () => ({
				content: "ok",
				toolCalls: [],
			})),
		};

		const registry = new ToolRegistry();
		const loop = new AgentLoop({
			provider,
			tools: registry,
			sessions: new SessionManager(sessionStorage),
			workspace: "/tmp/nooa",
			maxIterations: 2,
		});
		void loop;

		expect(registry.get("spawn")).toBeDefined();
		expect(registry.get("subagent")).toBeDefined();
	});

	it("prevents spawn recursion", async () => {
		const provider = {
			generate: mock(async () => ({
				content: "ok",
				toolCalls: [],
			})),
		};

		const registry = new ToolRegistry();
		const loop = new AgentLoop({
			provider,
			tools: registry,
			sessions: new SessionManager(sessionStorage),
			workspace: "/tmp/nooa",
			maxIterations: 2,
		});
		void loop;

		const spawn = registry.get("spawn");
		const result = await spawn?.execute({ task: "spawn another task" });
		expect(result?.isError).toBe(true);
		expect(result?.forLlm).toContain("cannot call spawn");
	});
});
