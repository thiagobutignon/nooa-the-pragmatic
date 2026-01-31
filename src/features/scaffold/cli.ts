import { parseArgs } from "node:util";
import { executeScaffold } from "./execute";
import { logger } from "../../core/logger";

export async function scaffoldCli(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            json: { type: "boolean" },
            "dry-run": { type: "boolean" },
            force: { type: "boolean" },
            out: { type: "string" },
            "with-docs": { type: "boolean" }
        },
        allowPositionals: true,
        strict: false
    });

    const type = positionals[0] as "command" | "prompt";
    const name = positionals[1];

    if (!type || !name || !["command", "prompt"].includes(type)) {
        console.log("Usage: nooa scaffold <command|prompt> <name> [flags]");
        console.log("\nFlags:");
        console.log("  --dry-run      Log planned operations without writing to disk");
        console.log("  --force        Allow overwriting existing files");
        console.log("  --json         Output result as structured JSON");
        console.log("  --out <file>   Write results report to a specific file");
        console.log("  --with-docs    Generate documentation template");
        process.exitCode = 2;
        return;
    }

    try {
        const { results, traceId } = await executeScaffold({
            type,
            name,
            force: !!values.force,
            dryRun: !!values["dry-run"],
            withDocs: !!values["with-docs"]
        });

        const output = {
            schemaVersion: "1.0",
            ok: true,
            traceId,
            command: "scaffold",
            timestamp: new Date().toISOString(),
            kind: type,
            name: name,
            files: results,
            dryRun: !!values["dry-run"]
        };

        if (values.json) {
            const jsonOutput = JSON.stringify(output, null, 2);
            if (values.out) {
                const { writeFile } = await import("node:fs/promises");
                await writeFile(values.out as string, jsonOutput);
            } else {
                console.log(jsonOutput);
            }
        } else {
            console.log(`\n✅ Scaffold success (${traceId})`);
            if (values["dry-run"]) console.log("[DRY RUN CALLBACK] No files were actually written.");
            console.log(`Created ${type}: ${name}`);
            results.forEach(f => console.log(`  - ${f}`));
            
            if (!values["dry-run"]) {
                console.log("\nNext Steps:");
                if (type === "command") {
                    console.log(`  1. Run tests: bun test src/features/${name}`);
                    console.log(`  2. Check help: bun index.ts ${name} --help`);
                } else {
                    console.log(`  1. Validate prompt: bun index.ts prompt validate ${name}`);
                }
            }
        }
    } catch (e) {
        const err = e as Error;
        if (err.message.includes("Invalid name") || err.message.includes("already exists")) {
            console.error(`❌ Validation Error: ${err.message}`);
            process.exitCode = 2;
        } else {
            logger.error("scaffold.error", err);
            console.error(`❌ Runtime Error: ${err.message}`);
            process.exitCode = 1;
        }
    }
}

const scaffoldCommand = {
    name: "scaffold",
    description: "Standardize creation of new features and prompts",
    async execute({ rawArgs, bus }: any) {
        const index = rawArgs.indexOf("scaffold");
        await scaffoldCli(rawArgs.slice(index + 1));
    }
};

export default scaffoldCommand;
