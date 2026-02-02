import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { TelemetryStore } from "../../core/telemetry";

import { fileURLToPath } from "node:url";

const binPath = fileURLToPath(new URL("../../../index.ts", import.meta.url));

describe("nooa search", () => {
	it("shows help", async () => {
		const res = await execa("bun", [binPath, "search", "--help"], {
			reject: false,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa search");
		expect(res.stdout).toContain("<query>");
		expect(res.stdout).toContain("--json");
	});

	it("outputs JSON format", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-search-"));
		await writeFile(join(root, "example.txt"), "TODO: find me\n");
		const res = await execa(
			"bun",
			[binPath, "search", "TODO", root, "--json"],
			{ reject: false, env: { ...process.env, NOOA_SEARCH_ENGINE: "native" } },
		);
		await rm(root, { recursive: true, force: true });
		expect(res.exitCode).toBe(0);
		const data = JSON.parse(res.stdout);
		expect(Array.isArray(data)).toBe(true);
	});

	it("outputs plain format", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-search-"));
		await writeFile(join(root, "example.txt"), "TODO: find me\n");
		const res = await execa(
			"bun",
			[binPath, "search", "TODO", root, "--plain"],
			{ reject: false, env: { ...process.env, NOOA_SEARCH_ENGINE: "native" } },
		);
		await rm(root, { recursive: true, force: true });
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toMatch(/^[\w/.-]+:\d+:\d+:/m);
	});

	it("lists files only", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-search-"));
		await writeFile(join(root, "example.txt"), "TODO: find me\n");
		const res = await execa(
			"bun",
			[binPath, "search", "TODO", root, "--files-only"],
			{ reject: false, env: { ...process.env, NOOA_SEARCH_ENGINE: "native" } },
		);
		await rm(root, { recursive: true, force: true });
		expect(res.exitCode).toBe(0);
		const lines = res.stdout.split("\n").filter(Boolean);
		lines.forEach((line) => {
			expect(line).not.toContain(":");
		});
	});

	it("records telemetry", async () => {
		const root = await mkdtemp(join(tmpdir(), "nooa-search-"));
		const dbPath = join(root, "telemetry.db");
		await writeFile(join(root, "example.txt"), "TODO: find me\n");

		const res = await execa(
			"bun",
			[binPath, "search", "TODO", root, "--plain"],
			{
				reject: false,
				env: {
					...process.env,
					NOOA_SEARCH_ENGINE: "native",
					NOOA_DB_PATH: dbPath,
				},
			},
		);

		const telemetry = new TelemetryStore(dbPath);
		const rows = telemetry.list({ event: "search.success" });
		telemetry.close();
		await rm(root, { recursive: true, force: true });

		expect(res.exitCode).toBe(0);
		expect(rows.length).toBeGreaterThan(0);
	});
});
