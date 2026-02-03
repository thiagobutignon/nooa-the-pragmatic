import { beforeEach, describe, expect, mock, test } from "bun:test";
import skillsCommand from "./cli";

describe("Skills CLI", () => {
	const mockManager = {
		listSkills: mock(async () => []),
		createSkill: mock(async () => {}),
		deleteSkill: mock(async () => {}),
		enableSkill: mock(async () => {}),
		disableSkill: mock(async () => {}),
		showSkill: mock(async () => ({
			name: "test",
			description: "desc",
			content: "content",
		})),
		updateSkill: mock(async () => {}),
	};

	beforeEach(() => {
		mockManager.listSkills.mockClear();
		mockManager.createSkill.mockClear();
		mockManager.deleteSkill.mockClear();
		mockManager.enableSkill.mockClear();
		mockManager.disableSkill.mockClear();
		mockManager.showSkill.mockClear();
		mockManager.updateSkill.mockClear();
		process.exitCode = 0;
	});

	test("list subcommand", async () => {
		mockManager.listSkills.mockImplementation(async () => [
			{ name: "s1", description: "d1", enabled: true },
		]);
		await (skillsCommand.execute as any)(
			{ rawArgs: ["list"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.listSkills).toHaveBeenCalled();
	});

	test("list subcommand empty", async () => {
		mockManager.listSkills.mockImplementation(async () => []);
		await (skillsCommand.execute as any)(
			{ rawArgs: ["list"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.listSkills).toHaveBeenCalled();
	});

	test("add subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["add", "new-skill", "a description"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.createSkill).toHaveBeenCalledWith(
			"new-skill",
			"a description",
		);
	});

	test("add subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["add"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("remove subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["remove", "old-skill"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.deleteSkill).toHaveBeenCalledWith("old-skill");
	});

	test("remove subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["remove"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("enable subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["enable", "s1"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.enableSkill).toHaveBeenCalledWith("s1");
	});

	test("enable subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["enable"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("disable subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["disable", "s1"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.disableSkill).toHaveBeenCalledWith("s1");
	});

	test("disable subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["disable"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("show subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["show", "s1"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.showSkill).toHaveBeenCalledWith("s1");
	});

	test("show subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["show"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("update subcommand", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["update", "s1"], args: {}, flags: {} },
			mockManager,
		);
		expect(mockManager.updateSkill).toHaveBeenCalledWith("s1");
	});

	test("update subcommand error on missing name", async () => {
		await (skillsCommand.execute as any)(
			{ rawArgs: ["update"], args: {}, flags: {} },
			mockManager,
		);
		expect(process.exitCode).toBe(1);
	});

	test("help output", async () => {
		const spy = mock(() => {});
		const originalLog = console.log;
		console.log = spy;
		await (skillsCommand.execute as any)(
			{ rawArgs: ["help"], args: {}, flags: {} },
			mockManager,
		);
		expect(spy).toHaveBeenCalled();
		console.log = originalLog;
	});
});
