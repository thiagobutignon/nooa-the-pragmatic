import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../core/db/store";

// Set unique DB path and mock store
const dbPath = join(tmpdir(), `nooa-test-${Date.now()}-${Math.random()}.db`);
const testStore = new Store(dbPath);

mock.module("../../core/db", () => ({
	store: testStore,
}));

import { AiEngine } from "../ai/engine";
import * as execute from "./execute";

describe("Index Feature Integration", () => {
	afterEach(async () => {
		try {
			testStore.close();
			await fs.unlink(dbPath);
		} catch {}
	});

	test("semantic search quality regression (fixtures)", async () => {
		const embedSpy = spyOn(AiEngine.prototype, "embed").mockImplementation(
			async (opts) => {
				const inputs = Array.isArray(opts.input) ? opts.input : [opts.input];
				// @ts-expect-error
				const embeddings = inputs.map((text) => {
					if (typeof text !== "string") return [0, 0, 0];
					if (text.includes("login") || text.includes("auth")) return [1, 0, 0];
					if (text.includes("db") || text.includes("pool")) return [0, 1, 0];
					return [0, 0, 1];
				});
				return {
					embeddings,
					model: "mock",
					provider: "mock",
					usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 },
				} as unknown;
			},
		);

		const tempDir = await fs.mkdtemp(`${tmpdir()}/nooa-search-fixtures-`);
		try {
			await fs.mkdir(`${tempDir}/auth`, { recursive: true });
			await fs.mkdir(`${tempDir}/db`, { recursive: true });
			await fs.writeFile(
				`${tempDir}/auth/login.ts`,
				"export function login() {}",
			);
			await fs.writeFile(
				`${tempDir}/auth/jwt.ts`,
				"export function signJwt() {}",
			);
			await fs.writeFile(
				`${tempDir}/db/pool.ts`,
				"export function connectDb() {}",
			);

			await execute.clearIndex();
			await execute.indexRepo(tempDir);

			// We search for "authentication logic", which contains "auth" -> [1, 0, 0]
			const results = await execute.executeSearch("authentication logic", 5);
			const top = results.slice(0, 3).map((r) => r.path);

			// Should match login.ts (which contains "login")
			expect(top).toContain("auth/login.ts");
		} finally {
			await execute.clearIndex();
			await fs.rm(tempDir, { recursive: true, force: true });
			embedSpy.mockRestore();
		}
	});
});
