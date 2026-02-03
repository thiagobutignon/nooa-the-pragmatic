import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";


describe("sdk.mcp", () => {
	it("installs, lists, disables, enables, and uninstalls", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-mcp-"));
		const dbPath = join(root, "nooa.db");
		const originalDb = process.env.NOOA_DB_PATH;
		process.env.NOOA_DB_PATH = dbPath;
		try {
			const { sdk } = await import("./index");
			const installResult = await sdk.mcp.install({
				package: "@modelcontextprotocol/server-filesystem",
				name: "filesystem",
			});
			expect(installResult.ok).toBe(true);

			const listResult = await sdk.mcp.list({ installed: true });
			expect(listResult.ok).toBe(true);
			if (!listResult.ok) {
				throw new Error("Expected ok list result");
			}
			expect(listResult.data.length).toBeGreaterThan(0);

			const disableResult = await sdk.mcp.disable({ name: "filesystem" });
			expect(disableResult.ok).toBe(true);
			const enableResult = await sdk.mcp.enable({ name: "filesystem" });
			expect(enableResult.ok).toBe(true);

			const uninstallResult = await sdk.mcp.uninstall({ name: "filesystem" });
			expect(uninstallResult.ok).toBe(true);
		} finally {
			if (originalDb === undefined) {
				delete process.env.NOOA_DB_PATH;
			} else {
				process.env.NOOA_DB_PATH = originalDb;
			}
			await rm(root, { recursive: true, force: true });
		}
	});
});
