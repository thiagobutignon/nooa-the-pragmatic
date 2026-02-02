import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { SkillManager } from "./manager";

// Mock dependencies
const mockMkdir = mock(async () => {});
const mockWriteFile = mock(async () => {});
const mockReadFile = mock(async () => "");
const mockRm = mock(async () => {});
const mockReaddir = mock(async () => []);
const mockStat = mock(async () => ({ isDirectory: () => true }));

mock.module("node:fs/promises", () => ({
	mkdir: mockMkdir,
	writeFile: mockWriteFile,
	readFile: mockReadFile,
	rm: mockRm,
	readdir: mockReaddir,
	stat: mockStat,
}));

describe("SkillManager", () => {
	let manager: SkillManager;
	const skillsDir = "/mock/.agent/skills";

	beforeEach(() => {
		manager = new SkillManager(skillsDir);
		mockMkdir.mockClear();
		mockWriteFile.mockClear();
		mockReadFile.mockClear();
		mockRm.mockClear();
		mockReaddir.mockClear();
		mockStat.mockClear();
	});

	test("createSkill scaffolds files", async () => {
		await manager.createSkill("my-skill", "My description");

		expect(mockMkdir).toHaveBeenCalledWith(join(skillsDir, "my-skill"), {
			recursive: true,
		});
		expect(mockWriteFile).toHaveBeenCalledWith(
			join(skillsDir, "my-skill", "SKILL.md"),
			expect.stringContaining("name: my-skill"),
		);
	});

	test("deleteSkill removes directory", async () => {
		await manager.deleteSkill("my-skill");
		expect(mockRm).toHaveBeenCalledWith(join(skillsDir, "my-skill"), {
			recursive: true,
			force: true,
		});
	});

	test("disableSkill creates .disabled file", async () => {
		await manager.disableSkill("my-skill");
		expect(mockWriteFile).toHaveBeenCalledWith(
			join(skillsDir, "my-skill", ".disabled"),
			"",
		);
	});

	test("enableSkill removes .disabled file", async () => {
		await manager.enableSkill("my-skill");
		expect(mockRm).toHaveBeenCalledWith(
			join(skillsDir, "my-skill", ".disabled"),
			{ force: true },
		);
	});

	test("showSkill returns content", async () => {
		const content = "---\nname: my-skill\n---\n# My Skill";
		mockReadFile.mockResolvedValue(content);

		const result = await manager.showSkill("my-skill");
		expect(mockReadFile).toHaveBeenCalledWith(
			join(skillsDir, "my-skill", "SKILL.md"),
			"utf-8",
		);
		expect(result).toEqual({ name: "my-skill", description: "", content });
	});

	test("listSkills returns skills", async () => {
		mockReaddir.mockResolvedValue(["skill-1", "skill-2"]);
		mockStat.mockResolvedValue({ isDirectory: () => true });
		mockReadFile.mockResolvedValue(
			"---\nname: skill-1\ndescription: desc\n---\n",
		);

		const skills = await manager.listSkills();
		expect(skills).toHaveLength(2);
		expect(skills[0].name).toBe("skill-1");
	});
});
