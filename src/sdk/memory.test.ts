import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.memory", () => {
	it("adds and searches memory entries", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-mem-"));
		try {
			const { sdk } = await import("./index");
			const added = await sdk.memory.add({
				content: "remember this fact",
				type: "fact",
				scope: "repo",
				cwd: root,
			});
			expect(added.ok).toBe(true);

			const list = await sdk.memory.list({ cwd: root });
			expect(list.ok).toBe(true);
			if (list.ok) {
				expect(list.data.entries.length).toBeGreaterThan(0);
			}

			const search = await sdk.memory.search({ query: "fact", cwd: root });
			expect(search.ok).toBe(true);
			if (search.ok) {
				expect(search.data.entries.length).toBeGreaterThan(0);
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
