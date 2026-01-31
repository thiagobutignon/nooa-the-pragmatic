import { parseArgs } from "node:util";
import { executeScaffold } from "./execute";
import { logger } from "../../core/logger";

export async function scaffoldCli(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            json: { type: "boolean" },
            overwrite: { type: "boolean" }
        },
        allowPositionals: true,
        strict: false
    });

    const type = positionals[0] as "command" | "prompt";
    const name = positionals[1];

    if (!type || !name || !["command", "prompt"].includes(type)) {
        console.log("Usage: nooa scaffold <command|prompt> <name> [--overwrite]");
        process.exitCode = 2;
        return;
    }

    try {
        const { results, traceId } = await executeScaffold({
            type,
            name,
            overwrite: !!values.overwrite
        });

        if (values.json) {
            console.log(JSON.stringify({
                schemaVersion: "1.0",
                ok: true,
                traceId,
                command: "scaffold",
                timestamp: new Date().toISOString(),
                files: results
            }, null, 2));
        } else {
            console.log(`\n✅ Scaffold success (${traceId})`);
            console.log(`Created ${type}: ${name}`);
            results.forEach(f => console.log(`  - ${f}`));
        }
    } catch (e) {
        if ((e as any).code === "EEXIST") {
            console.error(`Error: File already exists. Use --overwrite to replace it.`);
        } else {
            logger.error("scaffold.error", e as Error);
        }
        process.exitCode = 1;
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
