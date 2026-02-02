import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { executeInit } from "../src/features/init/execute";
import { MemoryEngine } from "../src/features/memory/engine";
import { InjectionEngine } from "../src/features/prompt/injection";

const TEST_ROOT = join(process.cwd(), "tmp-test-root");

describe("NOOA Contract Tests", () => {
	beforeEach(async () => {
		await rm(TEST_ROOT, { recursive: true, force: true });
		await mkdir(TEST_ROOT, { recursive: true });
		process.env.NOOA_SEARCH_ENGINE = "native";
		process.env.NOOA_AI_PROVIDER = "mock";
	});

	afterEach(async () => {
		await rm(TEST_ROOT, { recursive: true, force: true });
	});

	describe("Init Contract", () => {
		it("should create .nooa directory and core files", async () => {
			const { results } = await executeInit({
				root: TEST_ROOT,
				name: "TEST_BOT",
				nonInteractive: true,
			} as any);

			expect(results.length).toBeGreaterThan(0);
			const soulContent = await readFile(
				join(TEST_ROOT, ".nooa/SOUL.md"),
				"utf-8",
			);
			expect(soulContent).toContain("TEST_BOT");
		});

		it("should fail if .nooa already exists without --force", async () => {
			await mkdir(join(TEST_ROOT, ".nooa"), { recursive: true });
			expect(executeInit({ root: TEST_ROOT } as any)).rejects.toThrow(
				"already exists",
			);
		});

		it("should succeed if .nooa already exists with --force", async () => {
			await mkdir(join(TEST_ROOT, ".nooa"), { recursive: true });
			const { results } = await executeInit({
				root: TEST_ROOT,
				force: true,
			} as any);
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe("Prompt Injection Contract", () => {
		it("should follow precedence: constitution -> soul -> user -> memory", async () => {
			const nooaDir = join(TEST_ROOT, ".nooa");
			await mkdir(nooaDir, { recursive: true });

			await writeFile(join(nooaDir, "CONSTITUTION.md"), "CONSTITUTION_CONTENT");
			await writeFile(join(nooaDir, "SOUL.md"), "SOUL_CONTENT");
			await writeFile(join(nooaDir, "USER.md"), "USER_CONTENT");

			const engine = new InjectionEngine({ root: TEST_ROOT });
			const { content, meta } = await engine.getInjectedContext();

			expect(meta.order).toEqual(["constitution", "soul", "user", "memory"]);
			expect(content).toContain("CONSTITUTION_CONTENT");
			expect(content).toContain("PRECEDENCE ENFORCEMENT");
			expect(meta.totalLimitBytes).toBeDefined();
			expect(meta.layerBudgets).toBeDefined();
		});

		it("should truncate content when budgets are exceeded", async () => {
			const nooaDir = join(TEST_ROOT, ".nooa");
			await mkdir(nooaDir, { recursive: true });

			const largeContent = "A".repeat(10000);
			await writeFile(join(nooaDir, "CONSTITUTION.md"), largeContent);

			const engine = new InjectionEngine({
				root: TEST_ROOT,
				budgets: { constitution: 100 } as any,
			});

			const { meta } = await engine.getInjectedContext();
			expect(meta.truncated).toBe(true);
			expect(meta.bytes.constitution).toBe(100);
		});
	});

	describe("Memory Contract", () => {
		it("should generate valid YAML entries", async () => {
			const engine = new MemoryEngine(TEST_ROOT);
			const entry = await engine.addEntry({
				type: "fact",
				scope: "project",
				confidence: "high",
				tags: ["test"],
				sources: ["unit-test"],
				content: "Valid memory",
			});

			expect(entry.id).toBeDefined();
			const date = entry.timestamp.split("T")[0];
			const content = await readFile(
				join(TEST_ROOT, `memory/${date}.md`),
				"utf-8",
			);
			expect(content).toContain("type: fact");
			expect(content).toContain("confidence: high");
		});

		it("should promote entries to durable memory", async () => {
			const engine = new MemoryEngine(TEST_ROOT);
			const entry = await engine.addEntry({
				type: "fact",
				scope: "project",
				confidence: "high",
				tags: ["test"],
				sources: ["unit-test"],
				content: "Promote me",
			});

			await engine.promoteEntry(entry.id);
			const durableContent = await readFile(
				join(TEST_ROOT, ".nooa/MEMORY.md"),
				"utf-8",
			);
			expect(durableContent).toContain(entry.id);
		});
	});

	describe("Reflection Contract", () => {
		it("should only reflect on material events", async () => {
			const { Reflector } = await import("../src/features/memory/reflect");
			const engine = new MemoryEngine(TEST_ROOT);
			const reflector = new Reflector(engine);

			// Non-material event
			await reflector.reflect({
				event: "search.query",
				level: "info",
				success: true,
			} as any);

			const results = await engine.search("Session Reflection");
			expect(results.length).toBe(0);
		});

		it("should reflect on material events", async () => {
			const { Reflector } = await import("../src/features/memory/reflect");
			const engine = new MemoryEngine(TEST_ROOT);
			const reflector = new Reflector(engine);

			await reflector.reflect({
				event: "commit.success",
				level: "info",
				success: true,
				trace_id: "t-1",
			} as any);

			const results = await engine.search("Session Reflection");
			expect(results.length).toBe(1);
			const r = results[0];
			if (!r) throw new Error("Expected result");
			expect(r.sources).toEqual(["telemetry:event:commit.success"]);
			expect(r.trace_id).toBe("t-1");
		});
		it("should cap reflections at 3 per session", async () => {
			const { Reflector } = await import("../src/features/memory/reflect");
			const engine = new MemoryEngine(TEST_ROOT);
			const reflector = new Reflector(engine);

			for (let i = 0; i < 5; i++) {
				await reflector.reflect({
					event: "commit.success",
					level: "info",
					success: true,
				} as any);
			}

			const results = await engine.search("Session Reflection");
			expect(results.length).toBe(3);
		});
	});

	describe("Locking Contract", () => {
		it("should prevent concurrent writes to memory", async () => {
			const engine = new MemoryEngine(TEST_ROOT);
			const writes = Array.from({ length: 5 }, (_, i) =>
				engine.addEntry({
					type: "fact",
					scope: "repo",
					confidence: "medium",
					tags: ["lock-test"],
					sources: [`t-${i}`],
					content: `Concurrent write ${i}`,
				}),
			);

			const results = await Promise.all(writes);
			expect(results.length).toBe(5);

			const entries = await engine.search("Concurrent write");
			expect(entries.length).toBe(5);
		});
	});
});
