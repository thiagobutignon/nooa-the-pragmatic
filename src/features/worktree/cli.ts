import type { Command, CommandContext } from "../../core/command";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { git } from "./git";

const worktreeHelp = `
Usage: nooa worktree <branch> [flags]

Flags:
  --base <branch>   Base branch (default: main)
  --no-install      Skip dependency install
  --no-test         Skip tests
  -h, --help        Show help
`;

const branchPattern = /^[A-Za-z0-9/_-]+$/;

const worktreeCommand: Command = {
	name: "worktree",
	execute: async ({ args, values }: CommandContext) => {
		if (values.help) {
			console.log(worktreeHelp);
			return;
		}

		const branch = args[1];
		if (!branch) {
			console.error("Error: Branch name is required.");
			process.exitCode = 2;
			return;
		}
		if (!branchPattern.test(branch)) {
			console.error("Error: Invalid branch name.");
			process.exitCode = 2;
			return;
		}

		const repoRoot = await git(["rev-parse", "--show-toplevel"], process.cwd());
		if (repoRoot.exitCode !== 0) {
			console.error("Error: Not a git repository.");
			process.exitCode = 2;
			return;
		}
		const root = repoRoot.stdout.trim();
		const base = (values.base as string | undefined) ?? "main";

		const baseRef = await git(["show-ref", "--verify", `refs/heads/${base}`], root);
		if (baseRef.exitCode !== 0) {
			console.error(`Error: Base branch '${base}' not found.`);
			process.exitCode = 2;
			return;
		}

		const worktreeDir = existsSync(join(root, ".worktrees"))
			? ".worktrees"
			: existsSync(join(root, "worktrees"))
				? "worktrees"
				: ".worktrees";
		const worktreePath = join(root, worktreeDir, branch);

		if (existsSync(worktreePath)) {
			console.error(`Error: Worktree '${branch}' already exists.`);
			process.exitCode = 2;
			return;
		}

		if (!existsSync(join(root, worktreeDir))) {
			await mkdir(join(root, worktreeDir), { recursive: true });
		}

		const ignoreCheck = await git(["check-ignore", "-q", worktreeDir], root);
		if (ignoreCheck.exitCode !== 0) {
			const gitignorePath = join(root, ".gitignore");
			const current = existsSync(gitignorePath)
				? await readFile(gitignorePath, "utf-8")
				: "";
			if (!current.includes(`${worktreeDir}\n`)) {
				const next =
					current +
					(current.endsWith("\n") || current.length === 0 ? "" : "\n") +
					`${worktreeDir}\n`;
				await writeFile(gitignorePath, next);
			}
		}

		const branchExists = await git(
			["show-ref", "--verify", `refs/heads/${branch}`],
			root,
		);
		const addArgs =
			branchExists.exitCode === 0
				? ["worktree", "add", worktreePath, branch]
				: ["worktree", "add", worktreePath, "-b", branch, base];
		const addResult = await git(addArgs, root);
		if (addResult.exitCode !== 0) {
			console.error(`Error: Git worktree failed: ${addResult.stderr}`);
			process.exitCode = 1;
			return;
		}

		const skipInstall = Boolean(values["no-install"]) ||
			process.env.NOOA_SKIP_INSTALL === "1";
		const skipTest = Boolean(values["no-test"]) ||
			process.env.NOOA_SKIP_TEST === "1";
		const childEnv = { ...process.env };
		delete childEnv.BUN_TEST;
		delete childEnv.BUN_TEST_FILE;
		delete childEnv.BUN_TEST_NAME;

		if (!skipInstall && existsSync(join(worktreePath, "package.json"))) {
			const installResult = await execa("bun", ["install"], {
				cwd: worktreePath,
				reject: false,
				env: childEnv,
			});
			if (installResult.exitCode !== 0) {
				console.error("Error: Dependency install failed.");
				process.exitCode = 1;
				return;
			}
		}

		if (!skipTest) {
			const testResult = await execa("bun", ["test"], {
				cwd: worktreePath,
				reject: false,
				env: childEnv,
			});
			if (testResult.exitCode !== 0) {
				console.error("Error: Tests failed.");
				if (testResult.stderr) {
					console.error(testResult.stderr);
				}
				process.exitCode = 1;
				return;
			}
		}
	},
};

export default worktreeCommand;
