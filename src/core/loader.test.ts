import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCommands } from "./registry";

// Helper to create a temp feature directory
async function createTempFeature(dirName: string, jsContent: string) {
	const featurePath = join(process.cwd(), "tmp_features", dirName);
	await mkdir(featurePath, { recursive: true });
	await writeFile(join(featurePath, "cli.ts"), jsContent);
	return featurePath;
}

describe("Command Loader", () => {
	const tmpDir = join(process.cwd(), "tmp_features");

	test("loads commands from directory", async () => {
		// Create a dummy feature
		await createTempFeature(
			"foo",
			`
            export default { 
                name: "foo", 
                description: "foo desc", 
                execute: async () => {} 
            };
        `,
		);

		// Create another dummy feature
		await createTempFeature(
			"bar",
			`
            export default { 
                name: "bar", 
                description: "bar desc", 
                execute: async () => {} 
            };
        `,
		);

		// Create invalid feature (no export)
		await createTempFeature(
			"baz",
			`
         console.log('no export');
     `,
		);

		const registry = await loadCommands(tmpDir); // This function doesn't exist yet

		expect(registry.get("foo")).toBeDefined();
		expect(registry.get("foo")?.description).toBe("foo desc");
		expect(registry.get("bar")).toBeDefined();
		expect(registry.get("baz")).toBeUndefined();
	});

	test("skips directories without cli.ts without logging an error", async () => {
		await mkdir(join(tmpDir, "no-cli"), { recursive: true });
		const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

		const registry = await loadCommands(tmpDir);

		expect(registry.get("no-cli")).toBeUndefined();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		consoleErrorSpy.mockRestore();
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});
});
