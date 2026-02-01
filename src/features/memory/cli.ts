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
            out: { type: "string" }
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
            console.log("  add <content>   Add a new memory entry to daily log");
            console.log("  search <query>  Search memory entries (lexical by default)");
            console.log("  promote <id>    Move a daily entry to durable memory");
            console.log("  get <id>        Show full details of a memory entry");
            console.log("  summarize       Curate daily logs into .nooa/MEMORY_SUMMARY.md");
            console.log("\nFlags:");
            console.log("  --semantic           Use semantic search instead of lexical");
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
