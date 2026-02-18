import { describe, expect, test } from "bun:test";
import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { execa } from "execa";
import { baseEnv, bunPath, repoRoot } from "../../test-utils/cli-env";
import { gatewayMeta, run } from "./cli";

describe("gateway feature", () => {
	test("status action succeeds", async () => {
		const result = await run({ action: "status" });
		expect(result.ok).toBe(true);
	});

	test("metadata exposes gateway command", () => {
		expect(gatewayMeta.name).toBe("gateway");
		expect(gatewayMeta.description.length).toBeGreaterThan(0);
	});
});

describe("gateway cli daemon", () => {
	afterEach(async () => {
		await execa(
			bunPath,
			[join(repoRoot, "index.ts"), "gateway", "--daemon", "stop", "--json"],
			{
				cwd: repoRoot,
				env: baseEnv,
				reject: false,
				timeout: 10_000,
			},
		);
	});

	test("parses --daemon status --json", async () => {
		const { stdout, exitCode } = await execa(
			bunPath,
			[join(repoRoot, "index.ts"), "gateway", "--daemon", "status", "--json"],
			{
				cwd: repoRoot,
				env: baseEnv,
				reject: false,
				timeout: 10_000,
			},
		);
		expect(exitCode).toBe(0);
		const json = JSON.parse(stdout);
		expect(json.mode).toBe("daemon");
		expect(typeof json.running).toBe("boolean");
	});

	test("parses --daemon start --json", async () => {
		const start = await execa(
			bunPath,
			[join(repoRoot, "index.ts"), "gateway", "--daemon", "start", "--json"],
			{
				cwd: repoRoot,
				env: baseEnv,
				reject: false,
				timeout: 10_000,
			},
		);
		expect(start.exitCode).toBe(0);
		const startJson = JSON.parse(start.stdout);
		expect(startJson.mode).toBe("daemon");
		expect(startJson.running).toBe(true);
		expect(startJson.pid).toBeGreaterThan(0);

		const stop = await execa(
			bunPath,
			[join(repoRoot, "index.ts"), "gateway", "--daemon", "stop", "--json"],
			{
				cwd: repoRoot,
				env: baseEnv,
				reject: false,
				timeout: 10_000,
			},
		);
		expect(stop.exitCode).toBe(0);
		const stopJson = JSON.parse(stop.stdout);
		expect(stopJson.mode).toBe("daemon");
		expect(stopJson.running).toBe(false);
	});
});
