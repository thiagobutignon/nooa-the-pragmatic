/**
 * Guardrail CLI Tests (TDD)
 * Test the guardrail command and its subcommands.
 */
import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardrailCli } from "./cli";
import { ExitCode } from "./contracts";

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
		await writeFile(
			join(tempDir, ".nooa/guardrails/profiles/zero-preguica.yaml"),
			testProfile.replace("test-profile", "zero-preguica"),
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
			consoleLogSpy.mockClear();
			await guardrailCli(["-h"]);
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls
				.map((c) => c[0])
				.join("\n") as string;
			expect(output).toContain("Usage: nooa guardrail");
		});

		it("should show help with --help flag", async () => {
			consoleLogSpy.mockClear();
			await guardrailCli(["--help"]);
			expect(consoleLogSpy).toHaveBeenCalled();
		});

		it("should include list/show/spec commands in help", async () => {
			consoleLogSpy.mockClear();
			await guardrailCli(["-h"]);
			const output = consoleLogSpy.mock.calls
				.map((c) => c[0])
				.join("\n") as string;
			expect(output).toContain("list");
			expect(output).toContain("show");
			expect(output).toContain("spec");
			expect(output).toContain("add");
			expect(output).toContain("remove");
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

	describe("spec thresholds and exclusions", () => {
		it("applies thresholds and exclusions from GUARDRAIL.md", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			const guardrailMd = `
# GUARDRAIL.md

## Enabled Profiles

- zero-preguica

## Thresholds

| Severity | Threshold |
|----------|-----------|
| critical | 0         |
| high     | 0         |
| medium   | 10        |
| low      | 0         |

## Exclusions

\`\`\`
**/*.test.ts
.nooa/guardrails/**
\`\`\`
`;
			await mkdir(join(tempDir, "src"), { recursive: true });
			const specProfile = `
refactor_name: zero-preguica
description: Spec profile for thresholds/exclusions
rules:
  - id: no-keep-todo
    description: No KEEP_TODO comments
    severity: low
    match:
      anyOf:
        - type: literal
          value: "KEEP_TODO"
`;
			await writeFile(
				join(tempDir, ".nooa/guardrails/profiles/zero-preguica.yaml"),
				specProfile,
			);
			await writeFile(
				join(tempDir, ".nooa/guardrails/GUARDRAIL.md"),
				guardrailMd,
			);
			await writeFile(
				join(tempDir, "src/keep.ts"),
				"// KEEP_TODO: keep\nconst x = 1;",
			);
			await writeFile(
				join(tempDir, "src/skip.test.ts"),
				"// KEEP_TODO: skip\nconst y = 2;",
			);

			const { execSync } = await import("node:child_process");
			execSync("git init && git add .", { cwd: tempDir, stdio: "ignore" });

			process.exitCode = 0;
			await guardrailCli(["check", "--spec", "--json"]);

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
			const report = JSON.parse(jsonOutput?.[0] as string);
			expect(report.summary.findingsTotal).toBe(1);
			expect(report.status).toBe("warning");
			expect(process.exitCode).toBe(ExitCode.WARNING_FINDINGS);
			process.exitCode = 0;
		});
	});

	describe("profile management commands", () => {
		it("lists available profiles", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			await guardrailCli(["list"]);

			const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
			expect(output).toContain("zero-preguica");
			expect(output).toContain("test");
		});

		it("shows normalized profile output", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			const auditProfile = `
refactor_name: audit
description: Auditor style profile
rules:
  - id: audit-rule
    description: Auditor match
    severity: low
    match:
      identifiers: ["HELLO"]
`;
			await writeFile(
				join(tempDir, ".nooa/guardrails/profiles/audit.yaml"),
				auditProfile,
			);

			await guardrailCli(["show", "audit"]);

			const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
			expect(output).toContain("type:");
			expect(output).toContain("literal");
		});

		it("adds and removes a profile", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			await guardrailCli(["add", "my-profile"]);
			const added = await Bun.file(
				join(tempDir, ".nooa/guardrails/profiles/my-profile.yaml"),
			).text();
			expect(added).toContain("refactor_name: my-profile");

			await guardrailCli(["remove", "my-profile", "--force"]);
			const exists = await Bun.file(
				join(tempDir, ".nooa/guardrails/profiles/my-profile.yaml"),
			).exists();
			expect(exists).toBe(false);
		});
	});

	describe("spec commands", () => {
		it("validates GUARDRAIL.md and referenced profiles", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			const guardrailMd = `
# GUARDRAIL.md

## Enabled Profiles

- zero-preguica
`;
			await writeFile(
				join(tempDir, ".nooa/guardrails/GUARDRAIL.md"),
				guardrailMd,
			);

			await guardrailCli(["spec", "validate"]);

			const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
			expect(output.toLowerCase()).toContain("valid");
		});

		it("shows spec summary", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			const guardrailMd = `
# GUARDRAIL.md

## Enabled Profiles

- zero-preguica
- security
`;
			await writeFile(
				join(tempDir, ".nooa/guardrails/GUARDRAIL.md"),
				guardrailMd,
			);

			await guardrailCli(["spec", "show"]);

			const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
			expect(output).toContain("zero-preguica");
			expect(output).toContain("security");
		});

		it("initializes GUARDRAIL.md when missing", async () => {
			consoleLogSpy.mockClear();
			process.chdir(tempDir);

			const specPath = join(tempDir, ".nooa/guardrails/GUARDRAIL.md");
			await rm(specPath, { force: true });

			await guardrailCli(["spec", "init"]);

			const content = await Bun.file(specPath).text();
			expect(content).toContain("Enabled Profiles");
			expect(content).toContain("zero-preguica");
		});
	});
});
