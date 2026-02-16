import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdir, readFile, rm, writeFile } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { SkillManager } from "./manager";

const rmAsync = promisify(rm);
const mkdirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

describe("SkillManager", () => {
	const testDir = join(process.cwd(), "temp-skills-test");
	let manager: SkillManager;

	beforeEach(async () => {
		if (existsSync(testDir)) {
			await rmAsync(testDir, { recursive: true, force: true });
		}
		await mkdirAsync(testDir, { recursive: true });
		manager = new SkillManager(testDir);
	});

	afterEach(async () => {
		if (existsSync(testDir)) {
			await rmAsync(testDir, { recursive: true, force: true });
		}
	});

	test("createSkill creates directory and main file", async () => {
		await manager.createSkill("test-skill", "a test skill");
		const skillDir = join(testDir, "test-skill");
		const mainFile = join(skillDir, "SKILL.md");

		expect(existsSync(skillDir)).toBe(true);
		expect(existsSync(mainFile)).toBe(true);

		const content = await readFileAsync(mainFile, "utf-8");
		expect(content).toContain("name: test-skill");
	});

	test("listSkills returns all skills", async () => {
		await manager.createSkill("skill1", "d1");
		await manager.createSkill("skill2", "d2");
		await manager.disableSkill("skill2");

		const skills = await manager.listSkills();
		expect(skills.length).toBe(2);
		expect(skills.find((s) => s.name === "skill1")?.enabled).toBe(true);
		expect(skills.find((s) => s.name === "skill2")?.enabled).toBe(false);
	});

	test("deleteSkill removes directory", async () => {
		await manager.createSkill("to-delete", "d");
		await manager.deleteSkill("to-delete");
		expect(existsSync(join(testDir, "to-delete"))).toBe(false);
	});

	test("enable/disable skill", async () => {
		await manager.createSkill("toggle", "d");
		await manager.disableSkill("toggle");
		expect(existsSync(join(testDir, "toggle", ".disabled"))).toBe(true);

		await manager.enableSkill("toggle");
		expect(existsSync(join(testDir, "toggle", ".disabled"))).toBe(false);
	});

	test("updateSkill verifies existence", async () => {
		await manager.createSkill("exists", "d");
		await manager.updateSkill("exists"); // Should not throw

		await expect(manager.updateSkill("doesnotexist")).rejects.toThrow();
	});

	test("showSkill handles frontmatter correctly", async () => {
		const skillDir = join(testDir, "fm-test");
		await mkdirAsync(skillDir, { recursive: true });
		await writeFileAsync(
			join(skillDir, "SKILL.md"),
			"---\nname: FM Test\ndescription: FM Desc\n---\nContent",
		);

		const skill = await manager.showSkill("fm-test");
		expect(skill.name).toBe("FM Test");
		expect(skill.description).toBe("FM Desc");
	});

	test("parseFrontmatter edge cases", async () => {
		// Access private method for edge cases
		const m = manager as unknown;

		// No frontmatter
		expect(m.parseFrontmatter("no fm")).toEqual({ name: "", description: "" });

		// Empty values
		expect(m.parseFrontmatter("---\nname: \ndescription: \n---")).toEqual({
			name: "",
			description: "",
		});

		// Multiline with missing values
		expect(m.parseFrontmatter("---\nname: hello\ndescription: \n---")).toEqual({
			name: "hello",
			description: "",
		});

		// Missing name/desc
		expect(m.parseFrontmatter("---\nrandom: field\n---")).toEqual({
			name: "",
			description: "",
		});
	});

	test("listSkills handles empty root", async () => {
		await rmAsync(testDir, { recursive: true, force: true });
		const skills = await manager.listSkills();
		expect(skills).toEqual([]);
	});
});
