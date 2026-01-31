import { describe, it, expect } from "bun:test";
import { execa } from "execa";
import { writeFile, rm } from "node:fs/promises";

const binPath = "./index.ts";

describe("nooa embed", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "embed", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa embed <text|file>");
		expect(res.stdout).toContain("--include-embedding");
		expect(res.stdout).toContain("--out <file>");
	});

	it("embeds text and omits vector by default", async () => {
		const res = await execa("bun", [binPath, "embed", "text", "hello"], {
			reject: false,
			env: { ...process.env, NOOA_EMBED_PROVIDER: "mock" },
		});
		const json = JSON.parse(res.stdout);
		expect(json.model).toBeDefined();
		expect(json.embedding).toBeUndefined();
	});

	it("embeds file and includes vector when flag set", async () => {
		await writeFile("tmp-embed.txt", "hello");
		const res = await execa(
			"bun",
			[binPath, "embed", "file", "tmp-embed.txt", "--include-embedding"],
			{
				reject: false,
				env: { ...process.env, NOOA_EMBED_PROVIDER: "mock" },
			},
		);
		const json = JSON.parse(res.stdout);
		expect(Array.isArray(json.embedding)).toBe(true);
		await rm("tmp-embed.txt", { force: true });
	});
});
