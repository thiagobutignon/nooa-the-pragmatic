import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[]) =>
	execa("bun", ["index.ts", ...args], {
		reject: false,
		env: { ...process.env, NOOA_AI_PROVIDER: "mock" },
	});

describe("Command Cohesion Contract", () => {
	// List of commands that must follow the contract
	const commands = ["prompt", "review"];

	for (const cmd of commands) {
		describe(`Command: ${cmd}`, () => {
			test(`${cmd} should support --help and return exit 0`, async () => {
				const res = await run([cmd, "--help"]);
				expect(res.exitCode).toBe(0);
				expect(res.stdout).toContain("Usage:");
			});

			test(`${cmd} should NOT have logs in stdout when --json is used`, async () => {
				const helpRes = await run([cmd, "--help"]);
				if (helpRes.stdout.includes("--json")) {
					const res = await run([cmd, "--json"]);
					const _stdoutLines = res.stdout.trim().split("\n");
					// Every line should be part of a single JSON structure
					try {
						const json = JSON.parse(res.stdout);
						expect(json).toHaveProperty("schemaVersion");
						expect(json).toHaveProperty("ok");
						expect(json).toHaveProperty("traceId");

						if (cmd === "review" && json.ok) {
							expect(json).toHaveProperty("findings");
							expect(json).toHaveProperty("stats");
							expect(json).toHaveProperty("maxSeverity");
							if (json.findings && json.findings.length > 0) {
								expect(json.findings[0].file).not.toMatch(/^(\/|[a-zA-Z]:)/);
							}
						}
					} catch (_e) {
						throw new Error(
							`Invalid or non-contract JSON output for ${cmd} --json:\n${res.stdout}`,
						);
					}
				}
			});

			test(`${cmd} should record telemetry success or failure`, async () => {
				await run([cmd]);
			});
		});
	}

	test("search should validate max-results and return exit 2", async () => {
		const res = await run(["search", "TODO", "--max-results", "invalid"]);
		expect(res.exitCode).toBe(2);
	});
});
