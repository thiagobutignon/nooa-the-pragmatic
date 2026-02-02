import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createTempMcpDb } from "../../features/mcp/test-utils";
import { Registry } from "./Registry";

test("aliases persist metadata and respect deletion", async () => {
	const { dbPath } = await createTempMcpDb();
	const db = new Database(dbPath);
	try {
		const registry = new Registry(db);

		await registry.aliasCreate("deploy", "mcp", ["call", "deploy"], {
			env: { NODE_ENV: "prod" },
			description: "Deploy alias",
		});

		const alias = await registry.aliasGet("deploy");
		expect(alias).toBeDefined();
		expect(alias?.name).toBe("deploy");
		expect(alias?.command).toBe("mcp");
		expect(alias?.args).toEqual(["call", "deploy"]);
		expect(alias?.env?.NODE_ENV).toBe("prod");
		expect(alias?.description).toBe("Deploy alias");

		const list = await registry.aliasList();
		expect(list.map((item) => item.name)).toContain("deploy");

		await registry.aliasDelete("deploy");
		const deleted = await registry.aliasGet("deploy");
		expect(deleted).toBeUndefined();
	} finally {
		db.close();
	}
});
