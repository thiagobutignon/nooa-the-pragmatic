import { describe, expect, test, afterAll } from "bun:test";
import { loadCommands } from "./registry";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";

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
        await createTempFeature("foo", `
            export default { 
                name: "foo", 
                description: "foo desc", 
                execute: async () => {} 
            };
        `);

        // Create another dummy feature
        await createTempFeature("bar", `
            export default { 
                name: "bar", 
                description: "bar desc", 
                execute: async () => {} 
            };
        `);

        // Create invalid feature (no export)
        await createTempFeature("baz", `
         console.log('no export');
     `);

        const registry = await loadCommands(tmpDir); // This function doesn't exist yet

        expect(registry.get("foo")).toBeDefined();
        expect(registry.get("foo")?.description).toBe("foo desc");
        expect(registry.get("bar")).toBeDefined();
        expect(registry.get("baz")).toBeUndefined();
    });

    afterAll(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });
});
