import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { openMcpDatabase } from "../../core/mcp/db";
import { Registry } from "../../core/mcp/Registry";
import type { McpServer } from "../../core/mcp/types";

const RECOMMENDED = [
	{
		name: "filesystem",
		package: "@modelcontextprotocol/server-filesystem",
	},
	{
		name: "github",
		package: "@modelcontextprotocol/server-github",
	},
];

type PromptInterface = {
	question(prompt: string): Promise<string>;
	close(): void;
};

type PromptFactory = () => PromptInterface;

const defaultPromptFactory: PromptFactory = () =>
	createInterface({ input: process.stdin, output: process.stdout });

let promptFactory: PromptFactory = defaultPromptFactory;
let interactiveOverride: boolean | undefined;

export function setInitPromptFactory(factory: PromptFactory) {
	promptFactory = factory;
}

export function resetInitPromptFactory() {
	promptFactory = defaultPromptFactory;
}

export function setInitInteractive(value: boolean | undefined) {
	interactiveOverride = value;
}

export function resetInitInteractive() {
	interactiveOverride = undefined;
}

function shouldRunInteractive(values: Record<string, unknown>): boolean {
	if (interactiveOverride !== undefined) {
		return interactiveOverride;
	}
	const hasTTY = !!process.stdin?.isTTY;
	const nonInteractive =
		!!values["non-interactive"] ||
		process.env.NOOA_NON_INTERACTIVE === "1" ||
		process.env.BUN_TEST === "1" ||
		process.env.NODE_ENV === "test" ||
		!hasTTY;
	return !nonInteractive;
}

async function askYesNo(
	prompt: PromptInterface,
	question: string,
	defaultYes = true,
): Promise<boolean> {
	const suffix = defaultYes ? " (Y/n): " : " (y/N): ";
	const answer = (await prompt.question(`${question}${suffix}`))
		.trim()
		.toLowerCase();
	if (!answer) return defaultYes;
	return answer.startsWith("y");
}

export async function initCommand(rawArgs: string[]): Promise<number> {
	const { values } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
			force: { type: "boolean" },
			"skip-github": { type: "boolean" },
			"github-token": { type: "string" },
			"non-interactive": { type: "boolean" },
		},
		allowPositionals: false,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp init [flags]

Flags:
  --force           Reinstall recommended MCPs even if already registered
  --skip-github     Do not install/configure the GitHub MCP
  --github-token    Personal access token to configure the GitHub MCP
  --non-interactive Skip interactive prompts (useful for automation)
  --json            Emit JSON summary of onboarding
  -h, --help        Show this help message`);
		return 0;
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	const summary: Array<{ name: string; installed: boolean }> = [];
	const interactive = shouldRunInteractive(values);
	let prompt: PromptInterface | undefined;

	try {
		if (interactive) {
			prompt = promptFactory();
		}

		for (const candidate of RECOMMENDED) {
			if (candidate.name === "github" && values["skip-github"]) {
				summary.push({ name: candidate.name, installed: false });
				continue;
			}

			let shouldInstall = true;
			if (interactive && prompt) {
				shouldInstall = await askYesNo(
					prompt,
					`Install the ${candidate.name} MCP?`,
					true,
				);
			}

			if (!shouldInstall) {
				summary.push({ name: candidate.name, installed: false });
				continue;
			}

			const server: McpServer = {
				id: randomUUID(),
				name: candidate.name,
				package: candidate.package,
				command: "bun",
				args: [],
				env: {},
				enabled: true,
			};

			if (candidate.name === "github") {
				let token =
					typeof values["github-token"] === "string"
						? values["github-token"].trim()
						: "";

				if (!token && interactive && prompt) {
					const configureGitHub = await askYesNo(
						prompt,
						"Configure a GitHub token for the GitHub MCP?",
						true,
					);
					if (configureGitHub) {
						const entered = (
							await prompt.question(
								"Enter GitHub Personal Access Token (leave blank to skip): ",
							)
						).trim();
						token = entered;
					}
				}

				if (token) {
					server.env = { GITHUB_TOKEN: token };
				}
			}

			const existing = await registry.get(candidate.name);
			if (existing && !values.force) {
				summary.push({ name: candidate.name, installed: true });
				continue;
			}

			if (existing && values.force) {
				await registry.remove(candidate.name);
			}

			await registry.add(server);
			summary.push({ name: candidate.name, installed: true });
		}

		if (values.json) {
			console.log(JSON.stringify({ summary }, null, 2));
		} else {
			console.log("🚀 MCP onboarding complete!");
			for (const entry of summary) {
				console.log(
					` - ${entry.name}: ${entry.installed ? "installed" : "skipped"}`,
				);
			}
			console.log("Run `nooa mcp list --installed` to see them.");
		}

		return 0;
	} catch (error) {
		console.error("Error initializing MCPs:", error);
		return 1;
	} finally {
		prompt?.close();
		db.close();
	}
}
