import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { execa } from "execa";
import { EventBus } from "../../core/event-bus";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";

const binPath = "./index.ts";
const TEST_DB = "telemetry-embed-test.db";
let originalDbPath: string | undefined;
let originalProvider: string | undefined;

beforeEach(() => {
	originalDbPath = process.env.NOOA_DB_PATH;
	process.env.NOOA_DB_PATH = TEST_DB;
	originalProvider = process.env.NOOA_EMBED_PROVIDER;
	process.env.NOOA_EMBED_PROVIDER = "mock";
	if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

afterEach(async () => {
	try {
		const { telemetry } = await import("../../core/telemetry");
		telemetry.close();
	} catch {
		// ignore
	}
	if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
	if (originalDbPath === undefined) {
		delete process.env.NOOA_DB_PATH;
	} else {
		process.env.NOOA_DB_PATH = originalDbPath;
	}
	if (originalProvider === undefined) {
		delete process.env.NOOA_EMBED_PROVIDER;
	} else {
		process.env.NOOA_EMBED_PROVIDER = originalProvider;
	}
});

describe("nooa embed", () => {
	it("shows help", async () => {
		const res = await execa(bunPath, [binPath, "embed", "--help"], {
			reject: false,
			env: baseEnv,
			cwd: repoRoot,
		});
		expect(res.exitCode).toBe(0);
		expect(res.stdout).toContain("Usage: nooa embed <text|file>");
		expect(res.stdout).toContain("--include-embedding");
		expect(res.stdout).toContain("--out <file>");
	});

	it("embeds text and omits vector by default", async () => {
		const res = await execa(bunPath, [binPath, "embed", "text", "hello"], {
			reject: false,
			env: { ...baseEnv, NOOA_EMBED_PROVIDER: "mock" },
			cwd: repoRoot,
		});
		const json = JSON.parse(res.stdout);
		expect(json.model).toBeDefined();
		expect(json.embedding).toBeUndefined();
	});

	it("embeds file and includes vector when flag set", async () => {
		await writeFile("tmp-embed.txt", "hello");
		const res = await execa(
			bunPath,
			[binPath, "embed", "file", "tmp-embed.txt", "--include-embedding"],
			{
				reject: false,
				env: { ...baseEnv, NOOA_EMBED_PROVIDER: "mock" },
				cwd: repoRoot,
			},
		);
		const json = JSON.parse(res.stdout);
		expect(Array.isArray(json.embedding)).toBe(true);
		await rm("tmp-embed.txt", { force: true });
	});

	it("records telemetry on success", async () => {
		const { default: cmd } = await import("./cli");
		const { telemetry } = await import("../../core/telemetry");

		await cmd.execute({
			args: ["embed", "text", "hello"],
			rawArgs: ["embed", "text", "hello"],
			values: {},
			bus: new EventBus(),
		});

		const rows = telemetry.list({ event: "embed.success" });
		expect(rows.length).toBeGreaterThan(0);
		telemetry.close();
	});

	it("records telemetry on failure", async () => {
		const { default: cmd } = await import("./cli");
		const { telemetry } = await import("../../core/telemetry");

		await cmd.execute({
			args: ["embed"],
			rawArgs: ["embed"],
			values: {},
			bus: new EventBus(),
		});

		const rows = telemetry.list({ event: "embed.failure" });
		expect(rows.length).toBeGreaterThan(0);
		telemetry.close();
	});
});
