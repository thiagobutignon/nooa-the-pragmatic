import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { EventBus } from "../../core/event-bus";
import worktreeCommand from "./cli";

async function initRepo(root: string) {
	await execa("git", ["init"], { cwd: root });
	await execa("git", ["branch", "-m", "main"], { cwd: root });
	await writeFile(join(root, ".gitignore"), ".worktrees\n");
	await writeFile(join(root, "README.md"), "hello\n");
	await execa("git", ["add", "."], { cwd: root });
	await execa(
		"git",
		[
			"-c",
			"user.email=test@example.com",
			"-c",
			"user.name=test",
			"commit",
			"-m",
			"init",
		],
		{ cwd: root },
	);
}

describe("worktree events", () => {
	let bus: EventBus;
	const events: Array<{ type: string }> = [];
	let root = "";
	let previousCwd = "";

	beforeEach(async () => {
		bus = new EventBus();
		events.length = 0;
		bus.on("worktree.acquired", (evt) => events.push(evt as { type: string }));
		bus.on("worktree.released", (evt) => events.push(evt as { type: string }));
		root = await mkdtemp(join(tmpdir(), "nooa-worktree-events-"));
		await initRepo(root);
		previousCwd = process.cwd();
		process.chdir(root);
	});

	afterEach(async () => {
		process.chdir(previousCwd);
		await rm(root, { recursive: true, force: true });
		process.exitCode = 0;
	});

	test("emits acquired and released events", async () => {
		const branch = "feat/event";
		await worktreeCommand.execute({
			args: ["worktree", branch],
			rawArgs: ["worktree", branch, "--no-install", "--no-test"],
			values: { "no-install": true, "no-test": true } as Record<
				string,
				unknown
			>,
			bus,
		});

		expect(existsSync(join(root, ".worktrees", branch))).toBe(true);

		await worktreeCommand.execute({
			args: ["worktree", "remove", branch],
			rawArgs: ["worktree", "remove", branch],
			values: {} as Record<string, unknown>,
			bus,
		});

		expect(events.find((e) => e.type === "worktree.acquired")).toBeTruthy();
		expect(events.find((e) => e.type === "worktree.released")).toBeTruthy();
	});
});
