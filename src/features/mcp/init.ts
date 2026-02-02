import { randomUUID } from "node:crypto";
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

export async function initCommand(rawArgs: string[]): Promise<number> {
	const { values } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
			force: { type: "boolean" },
			"skip-github": { type: "boolean" },
			"github-token": { type: "string" },
		},
		allowPositionals: false,
		strict: false,
	});

	if (values.help) {
		console.log(`Usage: nooa mcp init [flags]

Flags:
  --force           Reinstall recommended MCPs even if already registered
  --skip-github     Do not install/configure the GitHub MCP
  --github-token    Personal access token to configure GitHub MCP
  --json            Emit JSON summary of installed MCPs
  -h, --help        Show this help message`);
		return 0;
	}

	const db = openMcpDatabase();
	const registry = new Registry(db);
	const summary: Array<{ name: string; installed: boolean }> = [];
	try {
		for (const candidate of RECOMMENDED) {
			if (candidate.name === "github" && values["skip-github"]) {
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

			if (
				candidate.name === "github" &&
				values["github-token"] &&
				values["github-token"].trim()
			) {
				server.env = { GITHUB_TOKEN: values["github-token"] };
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
		db.close();
	}
}
