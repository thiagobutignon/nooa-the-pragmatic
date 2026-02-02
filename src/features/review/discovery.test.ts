import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverTests } from "./discovery";

describe("Test Discovery heuristic", () => {
	const createWorkspace = async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-discovery-"));
		await mkdir(join(root, "src"), { recursive: true });
		await mkdir(join(root, "tests"), { recursive: true });
		return root;
	};

	const cleanup = async (root: string) => {
		await rm(root, { recursive: true, force: true });
	};

	it("finds test in same directory", async () => {
		const root = await createWorkspace();
		try {
			await writeFile(join(root, "src/foo.ts"), "// source");
			await writeFile(join(root, "src/foo.test.ts"), "// test");
			await Bun.sleep(50);

			const candidates = await discoverTests(join(root, "src/foo.ts"), root);
			expect(candidates).toContain("src/foo.test.ts");
			expect(candidates.length).toBeGreaterThan(0);
		} finally {
			await cleanup(root);
		}
	});

	it("finds test in root tests/ directory", async () => {
		const root = await createWorkspace();
		try {
			await writeFile(join(root, "src/bar.ts"), "// source");
			await writeFile(join(root, "tests/bar.test.ts"), "// test");
			await Bun.sleep(50);

			const candidates = await discoverTests(join(root, "src/bar.ts"), root);
			expect(candidates).toContain("tests/bar.test.ts");
		} finally {
			await cleanup(root);
		}
	});

	it("returns empty array if no test found", async () => {
		const root = await createWorkspace();
		try {
			await writeFile(join(root, "src/baz.ts"), "// source");
			await Bun.sleep(50);

			const candidates = await discoverTests(join(root, "src/baz.ts"), root);
			expect(candidates).toEqual([]);
		} finally {
			await cleanup(root);
		}
	});
});
