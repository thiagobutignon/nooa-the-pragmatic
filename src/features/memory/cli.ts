import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { printError, renderJson, setExitCode } from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	type MemoryConfidence,
	type MemoryScope,
	type MemoryType,
} from "../../core/memory/schema";
import type { MemoryEntry } from "../../core/memory/schema";
import { summarizeMemory } from "./summarize";
import { MemoryEngine } from "./engine";

export const memoryMeta: AgentDocMeta = {
	name: "memory",
	description: "Manage NOOA's persistent memory",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const memoryHelp = `
Usage: nooa memory <add|search|promote|get|summarize> [args] [flags]

Manage NOOA's persistent memory.

Actions:
  add <content>        Add a new memory entry to daily log
  delete <id>          Delete a memory entry
  update <id> <text>   Update a memory entry
  clear                Wipe all memory (requires --force)
  export <path>        Export memory to JSON
  import <path>        Import memory from JSON
  search <query>       Search memory entries (lexical by default)
  promote <id>         Move a daily entry to durable memory
  get <id>             Show full details of a memory entry
  summarize            Curate daily logs into .nooa/MEMORY_SUMMARY.md

Flags:
  --semantic           Use semantic search instead of lexical
  --force              Confirm destructive actions
  --type <type>        decision|fact|preference|rule|gotcha
  --scope <scope>      project|user|repo|command
  --confidence <lvl>   low|medium|high
  --tags <tag>         Custom tags (repeatable)
  --json               Output as structured JSON
  -h, --help           Show help message

Examples:
  nooa memory add "Store key insight"
  nooa memory search "auth" --json
  nooa memory promote mem_123

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  memory.missing_action: Missing subcommand
  memory.missing_content: Memory content required
  memory.missing_id: Memory ID required
  memory.missing_path: Path required
  memory.missing_query: Search query required
  memory.force_required: --force required
  memory.not_found: Memory entry not found
  memory.runtime_error: Unexpected error
`;

export const memorySdkUsage = `
SDK Usage:
  const result = await memory.run({ action: "search", query: "auth" });
  if (result.ok) console.log(result.data.entries);
`;

export const memoryUsage = {
	cli: "nooa memory <add|search|promote|get|summarize> [args] [flags]",
	sdk: "await memory.run({ action: \"search\", query: \"auth\" })",
	tui: "MemoryConsole()",
};

export const memorySchema = {
	action: { type: "string", required: true },
	id: { type: "string", required: false },
	content: { type: "string", required: false },
	query: { type: "string", required: false },
	path: { type: "string", required: false },
	type: { type: "string", required: false },
	scope: { type: "string", required: false },
	confidence: { type: "string", required: false },
	tags: { type: "string", required: false },
	"trace-id": { type: "string", required: false },
	semantic: { type: "boolean", required: false },
	out: { type: "string", required: false },
	force: { type: "boolean", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const memoryOutputFields = [
	{ name: "action", type: "string" },
	{ name: "entry", type: "string" },
	{ name: "entries", type: "string" },
	{ name: "id", type: "string" },
	{ name: "path", type: "string" },
	{ name: "message", type: "string" },
];

export const memoryErrors = [
	{ code: "memory.missing_action", message: "Missing subcommand." },
	{ code: "memory.missing_content", message: "Memory content required." },
	{ code: "memory.missing_id", message: "Memory ID required." },
	{ code: "memory.missing_path", message: "Path required." },
	{ code: "memory.missing_query", message: "Search query required." },
	{ code: "memory.force_required", message: "--force required." },
	{ code: "memory.not_found", message: "Memory entry not found." },
	{ code: "memory.runtime_error", message: "Unexpected error." },
];

export const memoryExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const memoryExamples = [
	{
		input: "nooa memory add \"Store key insight\"",
		output: "Add a new key insight to the agent's long-term memory.",
	},
	{
		input: "nooa memory search \"auth\" --json",
		output: "Search memory for entries related to 'auth' and return JSON.",
	},
	{
		input: "nooa memory promote mem_123",
		output: "Promote memory entry 'mem_123' to durable storage.",
	},
];

export interface MemoryRunInput {
	action?: string;
	id?: string;
	content?: string;
	query?: string;
	path?: string;
	type?: MemoryType;
	scope?: MemoryScope;
	confidence?: MemoryConfidence;
	tags?: string[];
	traceId?: string;
	semantic?: boolean;
	out?: string;
	force?: boolean;
	json?: boolean;
}

export interface MemoryRunResult {
	action: string;
	entry?: MemoryEntry;
	entries?: MemoryEntry[];
	id?: string;
	query?: string;
	path?: string;
	message?: string;
}

const parseTags = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}
	return [];
};

const formatEntrySummary = (entry: MemoryEntry) => {
	const snippet = entry.content.slice(0, 100);
	const suffix = entry.content.length > 100 ? "..." : "";
	return `- [${entry.id}] (${entry.type}) ${snippet}${suffix}`;
};

export async function run(
	input: MemoryRunInput,
): Promise<SdkResult<MemoryRunResult>> {
	try {
		const action = input.action;
		if (!action) {
			return {
				ok: false,
				error: sdkError("memory.missing_action", "Missing subcommand."),
			};
		}

		const engine = new MemoryEngine();

		switch (action) {
			case "add": {
				if (!input.content) {
					return {
						ok: false,
						error: sdkError("memory.missing_content", "Memory content required."),
					};
				}

				const entry = await engine.addEntry({
					type: input.type || "fact",
					scope: input.scope || "repo",
					confidence: input.confidence || "medium",
					tags: input.tags || [],
					sources: [],
					content: input.content,
					trace_id: input.traceId,
				});

				return {
					ok: true,
					data: { action, entry },
				};
			}
			case "delete": {
				if (!input.id) {
					return {
						ok: false,
						error: sdkError("memory.missing_id", "Memory ID required."),
					};
				}
				await engine.deleteEntry(input.id);
				return { ok: true, data: { action, id: input.id } };
			}
			case "update": {
				if (!input.id) {
					return {
						ok: false,
						error: sdkError("memory.missing_id", "Memory ID required."),
					};
				}
				if (!input.content) {
					return {
						ok: false,
						error: sdkError("memory.missing_content", "Memory content required."),
					};
				}
				await engine.updateEntry(input.id, input.content);
				return { ok: true, data: { action, id: input.id } };
			}
			case "clear": {
				if (!input.force) {
					return {
						ok: false,
						error: sdkError("memory.force_required", "--force required."),
					};
				}
				await engine.clearAll();
				return { ok: true, data: { action, message: "Memory wiped." } };
			}
			case "export": {
				const path = input.path || input.out;
				if (!path) {
					return {
						ok: false,
						error: sdkError("memory.missing_path", "Path required."),
					};
				}
				await engine.exportData(path);
				return { ok: true, data: { action, path } };
			}
			case "import": {
				const path = input.path;
				if (!path) {
					return {
						ok: false,
						error: sdkError("memory.missing_path", "Path required."),
					};
				}
				await engine.importData(path);
				return { ok: true, data: { action, path } };
			}
			case "promote": {
				if (!input.id) {
					return {
						ok: false,
						error: sdkError("memory.missing_id", "Memory ID required."),
					};
				}
				await engine.promoteEntry(input.id);
				return { ok: true, data: { action, id: input.id } };
			}
			case "search": {
				if (!input.query) {
					return {
						ok: false,
						error: sdkError("memory.missing_query", "Search query required."),
					};
				}
				const entries = await engine.search(input.query, {
					semantic: input.semantic,
				});
				return { ok: true, data: { action, entries, query: input.query } };
			}
			case "list": {
				const entries = await engine.search("", { semantic: false });
				entries.sort(
					(a, b) =>
						new Date(b.timestamp).getTime() -
						new Date(a.timestamp).getTime(),
				);
				return { ok: true, data: { action, entries } };
			}
			case "get": {
				if (!input.id) {
					return {
						ok: false,
						error: sdkError("memory.missing_id", "Memory ID required."),
					};
				}
				const entry = await engine.getEntryById(input.id);
				if (!entry) {
					return {
						ok: false,
						error: sdkError("memory.not_found", "Memory entry not found."),
					};
				}
				return { ok: true, data: { action, entry } };
			}
			case "summarize": {
				const path = await summarizeMemory(process.cwd());
				return { ok: true, data: { action, path } };
			}
			default:
				return {
					ok: false,
					error: sdkError("memory.missing_action", "Missing subcommand."),
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("memory.runtime_error", message),
		};
	}
}

const memoryBuilder = new CommandBuilder<MemoryRunInput, MemoryRunResult>()
	.meta(memoryMeta)
	.usage(memoryUsage)
	.schema(memorySchema)
	.help(memoryHelp)
	.sdkUsage(memorySdkUsage)
	.outputFields(memoryOutputFields)
	.examples(memoryExamples)
	.errors(memoryErrors)
	.exitCodes(memoryExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			type: { type: "string" },
			scope: { type: "string" },
			confidence: { type: "string" },
			tags: { type: "string", multiple: true },
			"trace-id": { type: "string" },
			semantic: { type: "boolean" },
			out: { type: "string" },
			force: { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const action = positionals[1];
		const id = positionals[2];
		const content = positionals.slice(2).join(" ");
		const updateContent = positionals.slice(3).join(" ");
		const query = positionals.slice(2).join(" ");
		const path = positionals[2];

		return {
			action,
			id,
			content:
				action === "update"
					? updateContent
					: action === "add"
						? content
						: undefined,
			query: action === "search" ? query : undefined,
			path:
				action === "export" || action === "import" ? path : undefined,
			type: typeof values.type === "string" ? (values.type as MemoryType) : undefined,
			scope:
				typeof values.scope === "string"
					? (values.scope as MemoryScope)
					: undefined,
			confidence:
				typeof values.confidence === "string"
					? (values.confidence as MemoryConfidence)
					: undefined,
			tags: parseTags(values.tags),
			traceId: typeof values["trace-id"] === "string" ? values["trace-id"] : undefined,
			semantic: Boolean(values.semantic),
			out: typeof values.out === "string" ? values.out : undefined,
			force: Boolean(values.force),
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}

		switch (output.action) {
			case "add":
				if (output.entry) {
					console.log(`\n✅ Memory added: ${output.entry.id}`);
					console.log(
						`Type: ${output.entry.type} | Scope: ${output.entry.scope} | Confidence: ${output.entry.confidence}`,
					);
				}
				break;
			case "delete":
				console.log(`\n🗑️ Memory entry ${output.id} deleted.`);
				break;
			case "update":
				console.log(`\n✏️ Memory entry ${output.id} updated.`);
				break;
			case "clear":
				console.log("\n⚠️ All memory entries wiped.");
				break;
			case "export":
				console.log(`\n📦 Memory exported to ${output.path}`);
				break;
			case "import":
				console.log(`\n📥 Memory imported from ${output.path}`);
				break;
			case "promote":
				console.log(`\n🚀 Memory entry ${output.id} promoted to Durable (.nooa/MEMORY.md)`);
				break;
			case "search":
				if (output.entries) {
					console.log(
						`\n🔍 Found ${output.entries.length} memory entries for "${output.query ?? ""}":`,
					);
					for (const entry of output.entries) {
						console.log(formatEntrySummary(entry));
					}
				}
				break;
			case "list":
				console.log("\n📅 Recent Memory Entries:");
				if (!output.entries || output.entries.length === 0) {
					console.log("  (none)");
					break;
				}
				for (const entry of output.entries) {
					console.log(
						`- [${entry.id}] ${entry.timestamp.split("T")[0]} (${entry.type}) ${entry.content.slice(0, 80)}...`,
					);
				}
				break;
			case "get":
				if (output.entry) {
					console.log(`\n--- Memory ${output.entry.id} ---`);
					console.log(`Timestamp: ${output.entry.timestamp}`);
					console.log(`Type: ${output.entry.type} | Scope: ${output.entry.scope}`);
					console.log(`Confidence: ${output.entry.confidence}`);
					console.log(`Tags: ${output.entry.tags.join(", ")}`);
					console.log(`\n${output.entry.content}`);
				}
				break;
			case "summarize":
				console.log(`\n📝 Memory summary generated: ${output.path}`);
				console.log("This summary will now be included in prompt context.");
				break;
			default:
				break;
		}
	})
	.onFailure((error) => {
		printError(error);
		setExitCode(error, [
			"memory.missing_action",
			"memory.missing_content",
			"memory.missing_id",
			"memory.missing_path",
			"memory.missing_query",
			"memory.force_required",
			"memory.not_found",
		]);
	})
	.telemetry({
		eventPrefix: "memory",
		successMetadata: (input, output) => ({
			action: output.action,
			scope: input.scope,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const memoryAgentDoc = memoryBuilder.buildAgentDoc(false);
export const memoryFeatureDoc = (includeChangelog: boolean) =>
	memoryBuilder.buildFeatureDoc(includeChangelog);

const memoryCommand = memoryBuilder.build();

export default memoryCommand;
