import { randomUUID } from "node:crypto";
import { openMcpDatabase } from "../core/mcp/db";
import { Registry } from "../core/mcp/Registry";
import { ServerManager } from "../core/mcp/ServerManager";
import type { McpServer } from "../core/mcp/types";
import { deriveServerName, parseEnvEntries } from "../features/mcp/helpers";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface McpListInput {
	installed?: boolean;
	enabled?: boolean;
}

export interface McpInstallInput {
	package?: string;
	name?: string;
	command?: string;
	args?: string[];
	env?: string[];
	force?: boolean;
}

export interface McpNameInput {
	name?: string;
}

export interface McpCallInput {
	name?: string;
	tool?: string;
	args?: Record<string, unknown>;
	retries?: number;
	timeout?: number;
	backoff?: number;
}

export interface McpResourceInput {
	name?: string;
	uri?: string;
}

export interface McpConfigureInput {
	name?: string;
	command?: string;
	args?: string[];
	env?: string[];
	envFile?: string[];
	enable?: boolean;
	disable?: boolean;
}

export interface McpAliasCreateInput {
	name?: string;
	command?: string;
	args?: string[];
	env?: string[];
	description?: string;
}

export interface McpMarketplaceInput {
	query?: string;
	libraryName?: string;
	verifiedOnly?: boolean;
	limit?: number;
	apiKey?: string;
	fetchFn?: typeof fetch;
}

function parseNumber(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function list(
	input: McpListInput = {},
): Promise<SdkResult<McpServer[]>> {
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		let mcps: McpServer[];
		if (input.installed) {
			mcps = await registry.listAll();
		} else if (input.enabled) {
			mcps = await registry.listEnabled();
		} else {
			mcps = await registry.listEnabled();
		}
		return { ok: true, data: mcps };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "List failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function install(
	input: McpInstallInput,
): Promise<SdkResult<McpServer>> {
	if (!input.package) {
		return {
			ok: false,
			error: sdkError("invalid_input", "package is required.")
		};
	}
	const name = input.name ?? deriveServerName(input.package);
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const existing = await registry.get(name);
		if (existing && !input.force) {
			return {
				ok: false,
				error: sdkError("validation_error", "MCP already exists.", { name }),
			};
		}
		const server: McpServer = {
			id: randomUUID(),
			name,
			package: input.package,
			command: input.command ?? "bun",
			args: input.args ?? [],
			env: parseEnvEntries(input.env),
			enabled: true,
		};
		await registry.add(server);
		return { ok: true, data: server };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Install failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function uninstall(
	input: McpNameInput,
): Promise<SdkResult<{ removed: boolean }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const server = await registry.get(input.name);
		if (!server) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		await registry.remove(input.name);
		return { ok: true, data: { removed: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Uninstall failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function enable(
	input: McpNameInput,
): Promise<SdkResult<{ enabled: boolean }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const mcp = await registry.get(input.name);
		if (!mcp) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		await registry.enable(input.name);
		return { ok: true, data: { enabled: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Enable failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function disable(
	input: McpNameInput,
): Promise<SdkResult<{ enabled: boolean }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const mcp = await registry.get(input.name);
		if (!mcp) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		await registry.disable(input.name);
		return { ok: true, data: { enabled: false } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Disable failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function info(
	input: McpNameInput,
): Promise<SdkResult<McpServer>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const server = await registry.get(input.name);
		if (!server) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		return { ok: true, data: server };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Info failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function call(
	input: McpCallInput,
): Promise<SdkResult<unknown>> {
	if (!input.name || !input.tool) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name and tool are required.")
		};
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	try {
		const mcp = await registry.get(input.name);
		if (!mcp) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		let client = serverManager.getClient(input.name);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(mcp);
		}
		const result = await client.callTool(input.tool, input.args ?? {}, {
			retries: parseNumber(input.retries, 3),
			timeout: parseNumber(input.timeout, 30000),
			backoff: parseNumber(input.backoff, 500),
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Call failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}

export async function resource(
	input: McpResourceInput,
): Promise<SdkResult<unknown>> {
	if (!input.name || !input.uri) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name and uri are required.")
		};
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	try {
		const server = await registry.get(input.name);
		if (!server) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		let client = serverManager.getClient(input.name);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(server);
		}
		const result = await client.readResource(input.uri);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Resource failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}

export async function health(
	input: McpNameInput,
): Promise<SdkResult<{ status: string; latency?: number; lastError?: string }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const status = await registry.healthCheck(input.name);
		return { ok: true, data: status };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Health check failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function test(
	input: McpNameInput,
): Promise<SdkResult<{ ok: boolean }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	const serverManager = new ServerManager();
	try {
		const server = await registry.get(input.name);
		if (!server) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}
		let client = serverManager.getClient(input.name);
		if (!client || !client.isRunning()) {
			client = await serverManager.start(server);
		}
		const ok = await client.ping();
		return { ok: true, data: { ok } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Test failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		await serverManager.stopAll();
		db.close();
	}
}

export async function configure(
	input: McpConfigureInput,
): Promise<SdkResult<McpServer>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	if (input.enable && input.disable) {
		return { ok: false, error: sdkError("invalid_input", "Cannot enable and disable together.") };
	}
	const db = openMcpDatabase();
	const registry = new Registry(db);
	try {
		const server = await registry.get(input.name);
		if (!server) {
			return { ok: false, error: sdkError("not_found", "MCP not found.") };
		}

		const updated: McpServer = {
			...server,
			command: input.command ?? server.command,
			args: input.args?.length ? input.args : server.args,
			env: {
				...(server.env ?? {}),
				...parseEnvEntries(input.env),
			},
			enabled: input.enable ?? (!input.disable ? server.enabled : false),
		};

		await registry.add(updated);
		return { ok: true, data: updated };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Configure failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function aliasCreate(
	input: McpAliasCreateInput,
): Promise<SdkResult<{ ok: boolean }>> {
	if (!input.name || !input.command) {
		return { ok: false, error: sdkError("invalid_input", "name and command are required.") };
	}
	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const { Database } = await import("bun:sqlite");
	const db = new Database(dbPath);
	const registry = new Registry(db);
	try {
		await registry.aliasCreate(input.name, input.command, input.args ?? [], {
			env: parseEnvEntries(input.env),
			description: input.description,
		});
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Alias create failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function aliasList(): Promise<SdkResult<Awaited<ReturnType<Registry["aliasList"]>>>> {
	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const { Database } = await import("bun:sqlite");
	const db = new Database(dbPath);
	const registry = new Registry(db);
	try {
		const aliases = await registry.aliasList();
		return { ok: true, data: aliases };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Alias list failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function aliasDelete(
	input: McpNameInput,
): Promise<SdkResult<{ ok: boolean }>> {
	if (!input.name) {
		return { ok: false, error: sdkError("invalid_input", "name is required.") };
	}
	const dbPath = process.env.NOOA_DB_PATH || "nooa.db";
	const { Database } = await import("bun:sqlite");
	const db = new Database(dbPath);
	const registry = new Registry(db);
	try {
		await registry.aliasDelete(input.name);
		return { ok: true, data: { ok: true } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Alias delete failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	} finally {
		db.close();
	}
}

export async function marketplace(
	input: McpMarketplaceInput,
): Promise<SdkResult<{ entries: Array<{ id: string; name: string; description?: string; verified?: boolean; tags?: string[] }> }>> {
	if (!input.query) {
		return { ok: false, error: sdkError("invalid_input", "query is required.") };
	}
	const apiKey = input.apiKey ?? process.env.CONTEXT7_API_KEY;
	const headers: Record<string, string> = {};
	if (apiKey) {
		headers.Authorization = `Bearer ${apiKey}`;
	}
	const fetchFn = input.fetchFn ?? fetch;
	const params = new URLSearchParams();
	params.set("query", input.query);
	if (input.libraryName) {
		params.set("libraryName", input.libraryName);
	}
	const url = `https://context7.com/api/v2/libs/search?${params.toString()}`;
	try {
		const response = await fetchFn(url, apiKey ? { headers } : undefined);
		if (!response.ok) {
			return { ok: false, error: sdkError("mcp_error", `Marketplace error: ${response.status}`) };
		}
		const payload = (await response.json()) as { libs?: Array<{ id: string; name: string; description?: string; verified?: boolean; tags?: string[] }> };
		let entries = payload.libs ?? [];
		if (input.verifiedOnly) {
			entries = entries.filter((entry) => entry.verified || entry.tags?.includes("verified"));
		}
		const limit = input.limit && input.limit > 0 ? input.limit : 10;
		return { ok: true, data: { entries: entries.slice(0, limit) } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("mcp_error", "Marketplace failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const mcp = {
	list,
	install,
	uninstall,
	enable,
	disable,
	info,
	call,
	resource,
	health,
	test,
	configure,
	alias: {
		create: aliasCreate,
		list: aliasList,
		delete: aliasDelete,
	},
	marketplace,
};
