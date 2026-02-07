import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardrailCli } from "./cli";

describe("Guardrail CLI", () => {
	let testDir: string;
	let profilesDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "nooa-guardrail-cli-"));
		profilesDir = join(testDir, ".nooa", "guardrails", "profiles");
		originalCwd = process.cwd();
		spyOn(process, "cwd").mockReturnValue(testDir);

		// Initialize git in testDir to avoid "not a git repository" errors if engine uses git
		const { execa } = await import("execa");
		await execa("git", ["init"], { cwd: testDir });
		await execa("git", ["config", "user.email", "test@example.com"], {
			cwd: testDir,
		});
		await execa("git", ["config", "user.name", "Test User"], { cwd: testDir });

		// Mock builtin profiles dir to point to our test dir if we want to test builtin logic
		// But getBuiltinProfilesDir is imported, so we might need to mock the module or just use absolute paths.
		// For simplicity, we'll test commands that use local paths first.

		process.exitCode = 0;
	});

	afterEach(async () => {
		process.cwd = () => originalCwd; // Restore
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
		process.exitCode = 0;
	});

	test("check fails without profile or spec", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await guardrailCli(["check"]);
		expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("required"));
		errSpy.mockRestore();
	});

	test("root help", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await guardrailCli(["--help"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
		logSpy.mockRestore();
	});

	test("check with spec loads spec file", async () => {
		// Mock parseGuardrailSpec? It's exported from ./spec.ts
		// We can't easily mock it if it's imported directly by cli.ts unless we mock the module.
		// Or we can create GUARDRAIL.md.

		await mkdir(join(process.cwd(), ".nooa/guardrails"), { recursive: true });
		await writeFile(
			join(process.cwd(), ".nooa/guardrails/GUARDRAIL.md"),
			"# Guardrails\nEnabled: default\n",
		);

		// We also need default profile to exist (created by init in beforeEach)

		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await guardrailCli(["check", "--spec"]);

		// It should run.
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	test("init creates default profile", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await guardrailCli(["init"]);

		const defaultProfile = join(profilesDir, "default.yaml");
		const content = await readFile(defaultProfile, "utf-8");
		expect(content).toContain("refactor_name: default");
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	test("validate passes for valid profile", async () => {
		await guardrailCli(["init"]); // Setup
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		const defaultProfile = join(profilesDir, "default.yaml");

		await guardrailCli(["validate", "--profile", defaultProfile]);
		expect(process.exitCode).toBe(0);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("is valid"));
		logSpy.mockRestore();
	});

	test("validate fails for missing profile", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		await guardrailCli(["validate"]);
		expect(process.exitCode).not.toBe(0);
		expect(errSpy).toHaveBeenCalled();
		errSpy.mockRestore();
	});

	test("validate fails for invalid profile content", async () => {
		await mkdir(profilesDir, { recursive: true });
		const invalidProfile = join(profilesDir, "invalid.yaml");
		await writeFile(invalidProfile, "invalid: yaml: content: [");

		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		// yaml parser throws, so this catches runtime error
		await guardrailCli(["validate", "-p", invalidProfile]);
		expect(process.exitCode).not.toBe(0);
		errSpy.mockRestore();
	});

	test("check runs guardrail checks", async () => {
		await guardrailCli(["init"]);
		const defaultProfile = join(profilesDir, "default.yaml");

		// Create a file to check
		await writeFile(join(testDir, "test.ts"), "// TODO: fix me");

		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		// Mock engine to avoid complex setup? Or just let it run if it works.
		// GuardrailEngine uses fs, so it should work on testDir.

		await guardrailCli(["check", "--profile", defaultProfile, "--json"]);
		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0][0];
		const report = JSON.parse(output);
		expect(report.status).toBe("warning");
		// wait, default profile has "no-todos" rule.
		// Let's verify report content.
		expect(report.summary.findingsTotal).toBeGreaterThanOrEqual(1);
		logSpy.mockRestore();
	});

	test("spec init creates GUARDRAIL.md", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await guardrailCli(["spec", "init"]);
		const specPath = join(testDir, ".nooa", "guardrails", "GUARDRAIL.md");
		const content = await readFile(specPath, "utf-8");
		expect(content).toContain("## Enabled Profiles");
		logSpy.mockRestore();
	});

	test("spec validate checks profiles", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		const errSpy = spyOn(console, "error").mockImplementation(() => {});

		// Create spec referencing a missing profile
		await guardrailCli(["spec", "init"]);

		// The default init uses "zero-preguica", which is builtin.
		// We'd need to mock loadBuiltinProfile or ensure it fails if we want failure.
		// Or if zero-preguica exists in builtin, it passes.
		// Let's modify spec to point to non-existent.
		const specPath = join(testDir, ".nooa", "guardrails", "GUARDRAIL.md");
		await writeFile(
			specPath,
			"# GUARDRAIL.md\n## Enabled Profiles\n- missing-profile\n",
		);

		await guardrailCli(["spec", "validate"]);
		expect(process.exitCode).not.toBe(0);
		expect(errSpy).toHaveBeenCalledWith(
			expect.stringContaining("missing profiles"),
		);

		logSpy.mockRestore();
		errSpy.mockRestore();
	});

	test("unknown subcommand shows help", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await guardrailCli(["unknown"]);
		expect(process.exitCode).not.toBe(0);
		expect(errSpy).toHaveBeenCalled();
		errSpy.mockRestore();
		logSpy.mockRestore();
	});

	test("add creates new profile", async () => {
		// We mock builtin module to return our test profiles dir
		mock.module("./builtin", () => ({
			getBuiltinProfilesDir: () => profilesDir,
			loadBuiltinProfile: async (name: string) => {
				if (name === "existing") return {};
				throw new Error("Not found");
			},
		}));

		// Re-import cli to pick up mock
		const { guardrailCli } = await import("./cli");

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		await guardrailCli(["add", "new-profile"]);

		const profilePath = join(profilesDir, "new-profile.yaml");
		expect(await readFile(profilePath, "utf-8")).toContain(
			"refactor_name: new-profile",
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Created profile"),
		);

		logSpy.mockRestore();
	});

	test("add fails if profile exists", async () => {
		mock.module("./builtin", () => ({
			getBuiltinProfilesDir: () => profilesDir,
		}));
		const { guardrailCli } = await import("./cli");

		await mkdir(profilesDir, { recursive: true });
		await writeFile(join(profilesDir, "exists.yaml"), "");

		const errSpy = spyOn(console, "error").mockImplementation(() => {});

		await guardrailCli(["add", "exists"]);
		expect(process.exitCode).not.toBe(0);
		expect(errSpy).toHaveBeenCalledWith(
			expect.stringContaining("already exists"),
		);

		errSpy.mockRestore();
	});

	test("list displays available profiles", async () => {
		mock.module("./builtin", () => ({
			getBuiltinProfilesDir: () => profilesDir,
		}));
		const { guardrailCli } = await import("./cli");

		await mkdir(profilesDir, { recursive: true });
		await writeFile(join(profilesDir, "p1.yaml"), "");
		await writeFile(join(profilesDir, "p2.yaml"), "");

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		await guardrailCli(["list"]);
		expect(logSpy).toHaveBeenCalledWith("p1");
		expect(logSpy).toHaveBeenCalledWith("p2");

		logSpy.mockRestore();
	});

	test("show displays profile content", async () => {
		mock.module("./builtin", () => ({
			getBuiltinProfilesDir: () => profilesDir,
		}));
		const { guardrailCli } = await import("./cli");

		await mkdir(profilesDir, { recursive: true });
		await writeFile(
			join(profilesDir, "show-me.yaml"),
			"refactor_name: show-me\ndescription: desc\nversion: '1.0'\nrules: []",
		);

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		await guardrailCli(["show", "show-me"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("refactor_name: show-me"),
		);

		logSpy.mockRestore();
	});

	test("remove deletes profile", async () => {
		mock.module("./builtin", () => ({
			getBuiltinProfilesDir: () => profilesDir,
		}));
		const { guardrailCli } = await import("./cli");

		await mkdir(profilesDir, { recursive: true });
		const pPath = join(profilesDir, "del.yaml");
		await writeFile(pPath, "");

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		await guardrailCli(["remove", "del", "--force"]);

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Removed profile"),
		);
		// check file gone
		// expect(await exists(pPath)).toBe(false);
		// exists needs import. Try-catch readFile
		try {
			await readFile(pPath);
			expect(true).toBe(false); // Should fail
		} catch {
			// expected
		}

		logSpy.mockRestore();
	});

	test("spec show lists enabled profiles", async () => {
		const { guardrailCli } = await import("./cli"); // normal import
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		// Setup spec
		await guardrailCli(["spec", "init"]);

		await guardrailCli(["spec", "show"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Enabled profiles:"),
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("- zero-preguica"),
		);

		logSpy.mockRestore();
	});
});
