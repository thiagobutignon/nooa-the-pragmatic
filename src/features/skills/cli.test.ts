import { beforeEach, describe, expect, mock, test } from "bun:test";
import { run } from "./cli";

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
		const result = await run({ action: "list", manager: mockManager as any });
		expect(result.ok).toBe(true);
		expect(mockManager.listSkills).toHaveBeenCalled();
	});

	test("list subcommand empty", async () => {
		mockManager.listSkills.mockImplementation(async () => []);
		const result = await run({ action: "list", manager: mockManager as any });
		expect(result.ok).toBe(true);
		expect(mockManager.listSkills).toHaveBeenCalled();
	});

	test("add subcommand", async () => {
		const result = await run({
			action: "add",
			name: "new-skill",
			description: "a description",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.createSkill).toHaveBeenCalledWith(
			"new-skill",
			"a description",
		);
	});

	test("add subcommand error on missing name", async () => {
		const result = await run({ action: "add", manager: mockManager as any });
		expect(result.ok).toBe(false);
	});

	test("remove subcommand", async () => {
		const result = await run({
			action: "remove",
			name: "old-skill",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.deleteSkill).toHaveBeenCalledWith("old-skill");
	});

	test("remove subcommand error on missing name", async () => {
		const result = await run({
			action: "remove",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(false);
	});

	test("enable subcommand", async () => {
		const result = await run({
			action: "enable",
			name: "s1",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.enableSkill).toHaveBeenCalledWith("s1");
	});

	test("enable subcommand error on missing name", async () => {
		const result = await run({
			action: "enable",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(false);
	});

	test("disable subcommand", async () => {
		const result = await run({
			action: "disable",
			name: "s1",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.disableSkill).toHaveBeenCalledWith("s1");
	});

	test("disable subcommand error on missing name", async () => {
		const result = await run({
			action: "disable",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(false);
	});

	test("show subcommand", async () => {
		const result = await run({
			action: "show",
			name: "s1",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.showSkill).toHaveBeenCalledWith("s1");
	});

	test("show subcommand error on missing name", async () => {
		const result = await run({
			action: "show",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(false);
	});

	test("update subcommand", async () => {
		const result = await run({
			action: "update",
			name: "s1",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(true);
		expect(mockManager.updateSkill).toHaveBeenCalledWith("s1");
	});

	test("update subcommand error on missing name", async () => {
		const result = await run({
			action: "update",
			manager: mockManager as any,
		});
		expect(result.ok).toBe(false);
	});

	test("help output", async () => {
		const result = await run({ action: "help", manager: mockManager as any });
		expect(result.ok).toBe(true);
	});
});
