import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ORIGINAL_PATH = process.env.PATH || "";

async function setupGhStub(script: string) {
	const dir = await mkdtemp(join(tmpdir(), "nooa-gh-"));
	const ghPath = join(dir, "gh");
	await writeFile(ghPath, script, { encoding: "utf8", mode: 0o755 });
	process.env.PATH = `${dir}:${ORIGINAL_PATH}`;
	return { dir, ghPath };
}

beforeEach(() => {
	process.env.PATH = ORIGINAL_PATH;
});

afterEach(() => {
	process.env.PATH = ORIGINAL_PATH;
});

test("ghPrCreate parses url from stdout", async () => {
	await setupGhStub(`#!/bin/sh

echo "https://example.com/pr/123"
exit 0
`);

	const { ghPrCreate } = await import("./gh");
	const result = await ghPrCreate({
		base: "main",
		head: "feat/test",
		title: "Test",
		body: "Body",
	});

	expect(result.url).toBe("https://example.com/pr/123");
});
