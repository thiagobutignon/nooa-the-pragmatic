/**
 * Built-in Rules Tests
 * Test the built-in guardrail profiles work correctly.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GuardrailEngine } from "./engine";
import { loadProfile } from "./profiles";

describe("Built-in Profiles", () => {
	describe("Profile Loading", () => {
		const profilesDir = join(process.cwd(), ".nooa/guardrails/profiles");

		it("should load zero-preguica profile", async () => {
			const profile = await loadProfile(
				join(profilesDir, "zero-preguica.yaml"),
			);
			expect(profile.refactor_name).toBe("zero-preguica");
			expect(profile.rules.length).toBe(4);
			expect(profile.rules.map((r) => r.id)).toContain("no-todo");
			expect(profile.rules.map((r) => r.id)).toContain("no-fixme");
		});

		it("should load security profile", async () => {
			const profile = await loadProfile(join(profilesDir, "security.yaml"));
			expect(profile.refactor_name).toBe("security");
			expect(profile.rules.length).toBeGreaterThanOrEqual(6);
			expect(profile.rules.map((r) => r.id)).toContain("hardcoded-secret");
			expect(profile.rules.map((r) => r.id)).toContain("sql-injection-risk");
		});

		it("should load dangerous-patterns profile", async () => {
			const profile = await loadProfile(
				join(profilesDir, "dangerous-patterns.yaml"),
			);
			expect(profile.refactor_name).toBe("dangerous-patterns");
			expect(profile.rules.length).toBe(6);
			expect(profile.rules.map((r) => r.id)).toContain("console-log-leftover");
		});

		it("should load semantic-sanitization profile", async () => {
			const profile = await loadProfile(
				join(profilesDir, "semantic-sanitization.yaml"),
			);
			expect(profile.refactor_name).toBe("semantic-sanitization");
			expect(profile.rules.map((r) => r.id)).toContain(
				"regex-sanitization-instructions",
			);
		});
	});

	describe("Zero-Preguiça Detection", () => {
		let tempDir: string;

		beforeAll(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "builtin-rules-test-"));
			execSync("git init", { cwd: tempDir, stdio: "ignore" });

			// Create files with various violations
			await writeFile(
				join(tempDir, "lazy.ts"),
				`// TODO: implement later\nconst x = 1;\n// FIXME: broken`,
			);
			await writeFile(join(tempDir, "clean.ts"), `const x = 1;\nconst y = 2;`);

			execSync("git add .", { cwd: tempDir, stdio: "ignore" });
		});

		afterAll(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should detect TODO violations", async () => {
			const profile = await loadProfile(
				join(process.cwd(), ".nooa/guardrails/profiles/zero-preguica.yaml"),
			);
			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			const todoFindings = findings.filter((f) => f.rule === "no-todo");
			expect(todoFindings.length).toBeGreaterThan(0);
		});

		it("should detect FIXME violations", async () => {
			const profile = await loadProfile(
				join(process.cwd(), ".nooa/guardrails/profiles/zero-preguica.yaml"),
			);
			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			const fixmeFindings = findings.filter((f) => f.rule === "no-fixme");
			expect(fixmeFindings.length).toBeGreaterThan(0);
		});
	});

	describe("Security Detection", () => {
		let tempDir: string;

		beforeAll(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "security-rules-test-"));
			execSync("git init", { cwd: tempDir, stdio: "ignore" });

			// Create file with security issues
			await writeFile(
				join(tempDir, "insecure.ts"),
				`const apiKey = "sk-1234567890abcdef";\nconst db = "postgres://user:pass@host/db";\neval(userInput);`,
			);
			await writeFile(
				join(tempDir, "secure.ts"),
				`const x = process.env.API_KEY;`,
			);

			execSync("git add .", { cwd: tempDir, stdio: "ignore" });
		});

		afterAll(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should detect hardcoded secrets", async () => {
			const profile = await loadProfile(
				join(process.cwd(), ".nooa/guardrails/profiles/security.yaml"),
			);
			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			const secretFindings = findings.filter(
				(f) => f.rule === "hardcoded-secret",
			);
			expect(secretFindings.length).toBeGreaterThan(0);
		});

		it("should detect eval usage", async () => {
			const profile = await loadProfile(
				join(process.cwd(), ".nooa/guardrails/profiles/security.yaml"),
			);
			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);

			const evalFindings = findings.filter((f) => f.rule === "eval-usage");
			expect(evalFindings.length).toBeGreaterThan(0);
		});
	});

	describe("Semantic Sanitization Detection", () => {
		let tempDir: string;

		beforeAll(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "semantic-sanitization-test-"));
			execSync("git init", { cwd: tempDir, stdio: "ignore" });

			await writeFile(
				join(tempDir, "sanitize.ts"),
				`function sanitizeMemorySummary(text: string): string {\n  text = text.replace(/always|never|must|should/gi, '');\n  text = text.replace(/^(skip|ignore|bypass).*/gim, '');\n  return text.slice(0, 500);\n}\n`,
			);

			execSync("git add .", { cwd: tempDir, stdio: "ignore" });
		});

		afterAll(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("should detect regex-based sanitization", async () => {
			const profile = await loadProfile(
				join(
					process.cwd(),
					".nooa/guardrails/profiles/semantic-sanitization.yaml",
				),
			);
			const engine = new GuardrailEngine(tempDir);
			const findings = await engine.evaluate(profile);
			const ruleFindings = findings.filter(
				(f) => f.rule === "regex-sanitization-instructions",
			);
			expect(ruleFindings.length).toBeGreaterThan(0);
		});
	});
});
