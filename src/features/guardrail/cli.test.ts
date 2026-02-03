/**
 * Guardrail CLI Tests (TDD)
 * Test the guardrail command and its subcommands.
 */
import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardrailCli } from "./cli";

describe("Guardrail CLI", () => {
	let tempDir: string;
	let originalCwd: string;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "guardrail-cli-test-"));
		originalCwd = process.cwd();

		// Create .nooa/guardrails directory
		await mkdir(join(tempDir, ".nooa/guardrails/profiles"), {
			recursive: true,
		});

		// Create test profile
		const testProfile = `
refactor_name: test-profile
description: Test profile for CLI
rules:
  - id: no-todos
    description: No TODO comments
    severity: low
    match:
      anyOf:
        - type: literal
          value: "TODO"
`;
		await writeFile(
			join(tempDir, ".nooa/guardrails/profiles/test.yaml"),
			testProfile,
		);

		// Create test file with TODO
		await writeFile(
			join(tempDir, "test.ts"),
			"// TODO: fix this\nconst x = 1;",
		);

		// Spy on console
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterAll(async () => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		process.chdir(originalCwd);
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("help", () => {
		it("should show help with -h flag", async () => {
			await guardrailCli(["-h"]);
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls[0]?.[0] as string;
			expect(output).toContain("Usage: nooa guardrail");
		});

		it("should show help with --help flag", async () => {
			consoleLogSpy.mockClear();
			await guardrailCli(["--help"]);
			expect(consoleLogSpy).toHaveBeenCalled();
		});
	});

	describe("validate subcommand", () => {
		it("should validate a valid profile", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);
			await guardrailCli([
				"validate",
				"--profile",
				".nooa/guardrails/profiles/test.yaml",
			]);
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls
				.map((c) => c[0])
				.join("\n") as string;
			expect(output).toContain("valid");
		});

		it("should report errors for invalid profile path", async () => {
			consoleErrorSpy.mockClear();
			process.chdir(tempDir);
			await guardrailCli(["validate", "--profile", "nonexistent.yaml"]);
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	describe("init subcommand", () => {
		it("should create guardrails directory structure", async () => {
			const initDir = await mkdtemp(join(tmpdir(), "guardrail-init-test-"));
			process.chdir(initDir);

			consoleLogSpy.mockClear();
			await guardrailCli(["init"]);

			expect(consoleLogSpy).toHaveBeenCalled();

			// Cleanup
			await rm(initDir, { recursive: true, force: true });
		});
	});

	describe("check subcommand", () => {
		it("should check files with profile", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			// Initialize git for deterministic file set
			const { execSync } = await import("node:child_process");
			try {
				execSync("git init && git add .", { cwd: tempDir, stdio: "ignore" });
			} catch {
				// Ignore if already init
			}

			await guardrailCli([
				"check",
				"--profile",
				".nooa/guardrails/profiles/test.yaml",
			]);
			expect(consoleLogSpy).toHaveBeenCalled();
		});

		it("should output JSON with --json flag", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			await guardrailCli([
				"check",
				"--profile",
				".nooa/guardrails/profiles/test.yaml",
				"--json",
			]);

			const calls = consoleLogSpy.mock.calls;
			const jsonOutput = calls.find((c) => {
				try {
					JSON.parse(c[0] as string);
					return true;
				} catch {
					return false;
				}
			});
			expect(jsonOutput).toBeDefined();
		});
	});
});
