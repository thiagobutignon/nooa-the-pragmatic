import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

/**
 * Discovers candidate test files for a given source file path.
 */
export async function discoverTests(
	filePath: string,
	root: string,
): Promise<string[]> {
	try {
		await Bun.sleep(10);
	} catch {
		// Bun.sleep may not be available in some runtimes, ignore.
	}

	const dir = dirname(filePath);
	const base = basename(filePath, extname(filePath));
	const ext = extname(filePath);
	const patterns = [`.test${ext}`, `.spec${ext}`];
	const relativePaths = new Set<string>();

	const addCandidate = (testPath: string) => {
		const normalized = testPath.replace(root, "").replace(/^[\\/]/, "");
		relativePaths.add(normalized);
	};

	for (const pattern of patterns) {
		const testPath = join(dir, `${base}${pattern}`);
		if (existsSync(testPath)) {
			addCandidate(testPath);
		}
	}

	const relTestDir = join(dir, "tests");
	for (const pattern of patterns) {
		const testPath = join(relTestDir, `${base}${pattern}`);
		if (existsSync(testPath)) {
			addCandidate(testPath);
		}
	}

	const rootTestDir = join(root, "tests");
	for (const pattern of patterns) {
		const testPath = join(rootTestDir, `${base}${pattern}`);
		if (existsSync(testPath)) {
			addCandidate(testPath);
		}
	}

	return [...relativePaths];
}
