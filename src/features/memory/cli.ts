import { parseArgs } from "node:util";
import { MemoryEngine } from "./engine";
import { type MemoryType, type MemoryScope, type MemoryConfidence } from "../../core/memory/schema";
import { summarizeMemory } from "./summarize";

export async function memoryCli(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            json: { type: "boolean" },
            type: { type: "string" },
            scope: { type: "string" },
            confidence: { type: "string" },
            tags: { type: "string", multiple: true },
            "trace-id": { type: "string" },
            semantic: { type: "boolean" },
            out: { type: "string" },
            force: { type: "boolean" }
        },
        allowPositionals: true,
        strict: false
    });

    const action = positionals[0];
    const engine = new MemoryEngine();

    try {
        if (action === "add") {
            const content = positionals.slice(1).join(" ");
            if (!content) throw new Error("Memory content is required.");

            const entry = await engine.addEntry({
                type: (values.type as MemoryType) || "fact",
                scope: (values.scope as MemoryScope) || "repo",
                confidence: (values.confidence as MemoryConfidence) || "medium",
                tags: (values.tags as string[]) || [],
                sources: [],
                content,
                trace_id: (values["trace-id"] as string) || undefined
            });

            if (values.json) {
                console.log(JSON.stringify({ ok: true, entry }, null, 2));
            } else {
                console.log(`\n✅ Memory added: ${entry.id}`);
                console.log(`Type: ${entry.type} | Scope: ${entry.scope} | Confidence: ${entry.confidence}`);
            }
        } else if (action === "delete") {
            const id = positionals[1];
            if (!id) throw new Error("Memory ID is required.");
            await engine.deleteEntry(id);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, deleted: id }, null, 2));
            } else {
                console.log(`\n🗑️ Memory entry ${id} deleted.`);
            }
        } else if (action === "update") {
            const id = positionals[1];
            const content = positionals.slice(2).join(" ");
            if (!id) throw new Error("Memory ID is required.");
            if (!content) throw new Error("New content is required.");

            await engine.updateEntry(id, content);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, updated: id }, null, 2));
            } else {
                console.log(`\n✏️ Memory entry ${id} updated.`);
            }
        } else if (action === "clear") {
            if (!values.force) throw new Error("Use --force to confirm wiping all memory.");
            await engine.clearAll();
            if (values.json) {
                console.log(JSON.stringify({ ok: true, clear: true }, null, 2));
            } else {
                console.log(`\n⚠️ All memory entries wiped.`);
            }
        } else if (action === "export") {
            const path = positionals[1] || values.out as string;
            if (!path) throw new Error("Output path required.");
            await engine.exportData(path);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, exported: path }, null, 2));
            } else {
                console.log(`\n📦 Memory exported to ${path}`);
            }
        } else if (action === "import") {
            const path = positionals[1];
            if (!path) throw new Error("Input path required.");
            await engine.importData(path);
            if (values.json) {
                console.log(JSON.stringify({ ok: true, imported: path }, null, 2));
            } else {
                console.log(`\n📥 Memory imported from ${path}`);
            }
        } else if (action === "promote") {
            const id = positionals[1];
            if (!id) throw new Error("Memory ID is required for promotion.");

            await engine.promoteEntry(id);

            if (values.json) {
                console.log(JSON.stringify({ ok: true, promoted: id }, null, 2));
            } else {
                console.log(`\n🚀 Memory entry ${id} promoted to Durable (.nooa/MEMORY.md)`);
            }
        } else if (action === "search") {
            const query = positionals.slice(1).join(" ");
            if (!query) throw new Error("Search query is required.");

            const entries = await engine.search(query, { semantic: values.semantic as boolean });

            if (values.json) {
                console.log(JSON.stringify({ ok: true, entries }, null, 2));
            } else {
                console.log(`\n🔍 Found ${entries.length} memory entries for "${query}":`);
                for (const entry of entries) {
                    console.log(`- [${entry.id}] (${entry.type}) ${entry.content.slice(0, 100)}${entry.content.length > 100 ? "..." : ""}`);
                }
            }
        } else if (action === "list") {
            const entries = await engine.search("", { semantic: false });
            entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            if (values.json) {
                console.log(JSON.stringify({ ok: true, entries }, null, 2));
            } else {
                console.log(`\n📅 Recent Memory Entries:`);
                if (entries.length === 0) console.log("  (none)");
                for (const entry of entries) {
                    console.log(`- [${entry.id}] ${entry.timestamp.split("T")[0]} (${entry.type}) ${entry.content.slice(0, 80)}...`);
                }
            }
        } else if (action === "get") {
            const id = positionals[1];
            if (!id) throw new Error("Memory ID is required.");

            const entry = await engine.getEntryById(id);
            if (!entry) throw new Error(`Memory entry ${id} not found.`);

            if (values.json) {
                console.log(JSON.stringify({ ok: true, entry }, null, 2));
            } else {
                console.log(`\n--- Memory ${entry.id} ---`);
                console.log(`Timestamp: ${entry.timestamp}`);
                console.log(`Type: ${entry.type} | Scope: ${entry.scope}`);
                console.log(`Confidence: ${entry.confidence}`);
                console.log(`Tags: ${entry.tags.join(", ")}`);
                console.log(`\n${entry.content}`);
            }
        } else if (action === "summarize") {
            const path = await summarizeMemory(process.cwd());
            if (values.json) {
                console.log(JSON.stringify({ ok: true, path }, null, 2));
            } else {
                console.log(`\n📝 Memory summary generated: ${path}`);
                console.log("This summary will now be included in prompt context.");
            }
        } else {
            console.log("Usage: nooa memory <add|search|promote|get|summarize> [args] [flags]");
            console.log("\nActions:");
            console.log("  add <content>       Add a new memory entry to daily log");
            console.log("  delete <id>         Delete a memory entry");
            console.log("  update <id> <text>  Update a memory entry");
            console.log("  clear               Wipe all memory (requires --force)");
            console.log("  export <path>       Export memory to JSON");
            console.log("  import <path>       Import memory from JSON");
            console.log("  search <query>      Search memory entries (lexical by default)");
            console.log("  promote <id>        Move a daily entry to durable memory");
            console.log("  get <id>            Show full details of a memory entry");
            console.log("  summarize           Curate daily logs into .nooa/MEMORY_SUMMARY.md");
            console.log("\nFlags:");
            console.log("  --semantic           Use semantic search instead of lexical");
            console.log("  --force              Confirm destructive actions");
            console.log("  --type <type>        decision|fact|preference|rule|gotcha");
            console.log("  --scope <scope>      project|user|repo|command");
            console.log("  --confidence <lvl>   low|medium|high");
            console.log("  --tags <tag>         Custom tags (repeatable)");
            console.log("  --json               Output as structured JSON");
            process.exitCode = 2;
        }
    } catch (e: any) {
        if (values.json) {
            console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
        } else {
            console.error(`❌ Memory Error: ${e.message}`);
        }
        process.exitCode = 1;
    }
}

const memoryCommand = {
    name: "memory",
    description: "Manage NOOA's persistent memory",
    async execute({ rawArgs, bus }: any) {
        const index = rawArgs.indexOf("memory");
        await memoryCli(rawArgs.slice(index + 1));
    }
};

export default memoryCommand;
