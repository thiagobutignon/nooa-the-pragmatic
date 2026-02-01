import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeReview } from "./execute";

describe("executeReview", () => {
	let root = "";

	let originalProvider: string | undefined;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "nooa-review-exec-"));
		originalProvider = process.env.NOOA_AI_PROVIDER;
		process.env.NOOA_AI_PROVIDER = "mock";
	});

	afterEach(async () => {
		if (originalProvider) {
			process.env.NOOA_AI_PROVIDER = originalProvider;
		} else {
			delete process.env.NOOA_AI_PROVIDER;
		}
		await rm(root, { recursive: true, force: true });
	});

	it("normalizes 'maintainability' category to 'arch'", async () => {
		// We need to mock the AI response somehow.
		// executeReview uses MockProvider if NOOA_AI_PROVIDER=mock
		const filePath = join(root, "test.ts");
		await writeFile(filePath, "console.log('test')");

		// Mock response content with 'maintainability'
		process.env.NOOA_AI_MOCK_CONTENT = JSON.stringify({
			schemaVersion: "1.0",
			ok: true,
			summary: "Test summary",
			findings: [
				{
					severity: "low",
					file: "test.ts",
					line: 1,
					category: "maintainability",
					message: "Maintainability issue",
					suggestion: "Refactor",
				},
			],
			stats: { files: 1, findings: 1 },
			maxSeverity: "low",
			truncated: false,
		});

		const { result } = await executeReview({
			path: filePath,
			json: true,
		});

		expect(result).toBeDefined();
		expect(result?.findings[0].category).toBe("arch");

		delete process.env.NOOA_AI_MOCK_CONTENT;
	});

	it("defaults null file to input_path", async () => {
		const filePath = join(root, "test.ts");
		await writeFile(filePath, "console.log('test')");

		process.env.NOOA_AI_MOCK_CONTENT = JSON.stringify({
			schemaVersion: "1.0",
			ok: true,
			summary: "Test summary",
			findings: [
				{
					severity: "low",
					file: null,
					line: 1,
					category: "style",
					message: "Style issue",
					suggestion: "Fix",
				},
			],
			stats: { files: 1, findings: 1 },
			maxSeverity: "low",
			truncated: false,
		});

		const { result } = await executeReview({
			path: filePath,
			json: true,
		});

		expect(result).toBeDefined();
		expect(result?.findings[0].file).toBe(filePath);

		delete process.env.NOOA_AI_MOCK_CONTENT;
	});
});
