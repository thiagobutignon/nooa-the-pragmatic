import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { execa } from "execa";
import { PolicyEngine } from "../../core/policy/PolicyEngine";

export async function checkCli(args: string[]) {
	const { values, positionals } = parseArgs({
		args,
		options: {
			staged: { type: "boolean" },
			json: { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
	});

	const checkHelp = `
Usage: nooa check [path] [flags]

Audit code against project policies (Zero-Preguiça).

Flags:
  --staged       Audit only staged files in git.
  --json         Output result as structured JSON.
  -h, --help     Show help message.

Examples:
  nooa check
  nooa check src --json
  nooa check --staged
`;

	if (values.help) {
		console.log(checkHelp);
		return;
	}

	const engine = new PolicyEngine();
	let filesToCheck: string[] = [];

	if (values.staged) {
		try {
			const { stdout } = await execa("git", [
				"diff",
				"--cached",
				"--name-only",
				"--diff-filter=ACMR",
			]);
			filesToCheck = stdout.split("\n").filter((f) => f.trim() !== "");
		} catch {
			console.error("❌ Not a git repository or git error.");
			process.exit(1);
		}
	} else {
		const target = positionals[0] || ".";
		filesToCheck = await growFileList(target);
	}

	const result = await engine.checkFiles(filesToCheck);

	if (values.json) {
		console.log(JSON.stringify(result, null, 2));
		if (!result.ok) process.exitCode = 2;
	} else {
		if (result.ok) {
			console.log("\n✅ Policy check passed. Code is NOOA-grade (anti-lazy).");
		} else {
			console.error(
				`\n❌ Policy violations found (${result.violations.length}):`,
			);
			for (const v of result.violations) {
				console.error(`  [${v.rule}] ${v.file}:${v.line} -> ${v.content}`);
				console.error(`  Reason: ${v.message}`);
			}
			process.exitCode = 2; // Policy violation exit code
		}
	}
}

async function growFileList(path: string): Promise<string[]> {
	const stat = await lstat(path);
	if (stat.isFile()) return [path];

	// Simple recursive glob-like expansion (ignoring .git, node_modules)
	const files: string[] = [];
	const entries = await readdir(path, { withFileTypes: true });

	for (const entry of entries) {
		const full = join(path, entry.name);
		if (entry.name === ".git" || entry.name === "node_modules") continue;
		if (entry.isDirectory()) {
			files.push(...(await growFileList(full)));
		} else {
			files.push(full);
		}
	}
	return files;
}

const checkCommand = {
	name: "check",
	description: "Audit code against project policies (Zero-Preguiça)",
	async execute({ rawArgs }: any) {
		const index = rawArgs.indexOf("check");
		await checkCli(rawArgs.slice(index + 1));
	},
};

export default checkCommand;
