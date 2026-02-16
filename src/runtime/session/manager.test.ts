import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "./manager";

describe("SessionManager", () => {
	let tmpDir: string;
	let manager: SessionManager;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "nooa-session-"));
		manager = new SessionManager(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("creates a new session", () => {
		const session = manager.getOrCreate("cli:direct");
		expect(session.key).toBe("cli:direct");
		expect(session.messages).toHaveLength(0);
	});

	it("returns existing session", () => {
		manager.getOrCreate("cli:direct");
		manager.addMessage("cli:direct", "user", "hello");
		const session = manager.getOrCreate("cli:direct");
		expect(session.messages).toHaveLength(1);
	});

	it("adds messages to session", () => {
		manager.getOrCreate("test:1");
		manager.addMessage("test:1", "user", "hello");
		manager.addMessage("test:1", "assistant", "hi there");
		const history = manager.getHistory("test:1");
		expect(history).toHaveLength(2);
		expect(history[0]?.role).toBe("user");
		expect(history[1]?.role).toBe("assistant");
	});

	it("saves and loads sessions (atomic)", async () => {
		manager.getOrCreate("persist:test");
		manager.addMessage("persist:test", "user", "remember me");
		await manager.save("persist:test");

		const manager2 = new SessionManager(tmpDir);
		const history = manager2.getHistory("persist:test");
		expect(history).toHaveLength(1);
		expect(history[0]?.content).toBe("remember me");
	});

	it("truncates history keeping last N", () => {
		manager.getOrCreate("trunc:test");
		for (let i = 0; i < 10; i += 1) {
			manager.addMessage("trunc:test", "user", `msg ${i}`);
		}
		manager.truncateHistory("trunc:test", 3);
		const history = manager.getHistory("trunc:test");
		expect(history).toHaveLength(3);
		expect(history[0]?.content).toBe("msg 7");
	});

	it("manages summary", () => {
		manager.getOrCreate("sum:test");
		manager.setSummary("sum:test", "User likes TypeScript");
		expect(manager.getSummary("sum:test")).toBe("User likes TypeScript");
	});
});
