import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.skills", () => {
	it("manages skills lifecycle", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-skills-"));
		try {
			const { sdk } = await import("./index");
			const add = await sdk.skills.add({
				name: "test-skill",
				description: "Test skill",
				rootDir: root,
			});
			expect(add.ok).toBe(true);

			const list1 = await sdk.skills.list({ rootDir: root });
			expect(list1.ok).toBe(true);
			if (list1.ok) {
				expect(list1.data.length).toBe(1);
				expect(list1.data[0]?.enabled).toBe(true);
			}

			const show = await sdk.skills.show({ name: "test-skill", rootDir: root });
			expect(show.ok).toBe(true);
			if (show.ok) {
				expect(show.data.name).toBe("test-skill");
			}

			const disabled = await sdk.skills.disable({ name: "test-skill", rootDir: root });
			expect(disabled.ok).toBe(true);

			const list2 = await sdk.skills.list({ rootDir: root });
			expect(list2.ok).toBe(true);
			if (list2.ok) {
				expect(list2.data[0]?.enabled).toBe(false);
			}

			const enabled = await sdk.skills.enable({ name: "test-skill", rootDir: root });
			expect(enabled.ok).toBe(true);

			const removed = await sdk.skills.remove({ name: "test-skill", rootDir: root });
			expect(removed.ok).toBe(true);

			const list3 = await sdk.skills.list({ rootDir: root });
			expect(list3.ok).toBe(true);
			if (list3.ok) {
				expect(list3.data.length).toBe(0);
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
