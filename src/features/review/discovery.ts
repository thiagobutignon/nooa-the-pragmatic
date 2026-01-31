import { existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";

/**
 * Discovers candidate test files for a given source file path.
 * Heuristic:
 * 1. foo.test.ts
 * 2. foo.spec.ts
 * 3. tests/foo.test.ts
 */
export async function discoverTests(filePath: string, root: string): Promise<string[]> {
	const candidates: string[] = [];
	const dir = dirname(filePath);
	const base = basename(filePath, extname(filePath));
	const ext = extname(filePath);

	// 1. Same directory: foo.test.ts, foo.spec.ts
	const sameDirTest = join(dir, `${base}.test${ext}`);
	const sameDirSpec = join(dir, `${base}.spec${ext}`);

	if (existsSync(sameDirTest)) candidates.push(sameDirTest);
	if (existsSync(sameDirSpec)) candidates.push(sameDirSpec);

	// 2. tests/ directory relative to file
	const testDir = join(dir, "tests", `${base}.test${ext}`);
	if (existsSync(testDir)) candidates.push(testDir);

    // 3. Absolute tests/ directory from root
    const rootTestDir = join(root, "tests", `${base}.test${ext}`);
    if (existsSync(rootTestDir) && rootTestDir !== testDir) candidates.push(rootTestDir);

	return candidates.map(c => c.replace(root, "").replace(/^[\\\/]/, ""));
}
