import { parseArgs } from "node:util";
import { execute{{Command}} } from "./execute";
import { logger } from "../../core/logger";

export async function {{camelName}}Cli(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            json: { type: "boolean" },
            out: { type: "string" },
            help: { type: "boolean", short: "h" }
        },
        allowPositionals: true,
        strict: false
    });

    if (values.help) {
        console.log("Usage: nooa {{name}} [flags]");
        console.log("\nFlags:");
        console.log("  --json    Output structure as JSON");
        console.log("  --out     Write results to a file");
        console.log("  -h, --help Show this help message");
        return;
    }

    try {
        const { getStdinText } = await import("../../core/io");
        
        // Example: Get input from positionals or stdin
        const input = positionals[0] || await getStdinText();

        const { result, traceId } = await execute{{Command}}({
            json: values.json,
            input,
            // Pass other flags here
        });

        const output = {
            schemaVersion: "1.0",
            ok: true,
            traceId,
            command: "{{name}}",
            timestamp: new Date().toISOString(),
            ...result
        };

        if (values.json) {
            const jsonOutput = JSON.stringify(output, null, 2);
            if (values.out) {
                const { writeFile } = await import("node:fs/promises");
                await writeFile(values.out, jsonOutput);
            } else {
                console.log(jsonOutput);
            }
        } else {
            // Provide human-readable output
            console.log(`✅ {{name}} success (${traceId})`);
            // Add custom logging here
        }
    } catch (e) {
        logger.error("{{name}}.error", e as Error);
        process.exitCode = 1;
    }
}

const {{camelName}}Command = {
    name: "{{name}}",
    description: "New feature: {{name}}",
    async execute({ rawArgs, bus }: any) {
        const index = rawArgs.indexOf("{{name}}");
        await {{camelName}}Cli(rawArgs.slice(index + 1));
    }
};

export default {{camelName}}Command;
