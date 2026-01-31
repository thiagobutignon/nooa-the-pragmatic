import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CLI_TEMPLATE, EXECUTE_TEMPLATE, TEST_TEMPLATE, PROMPT_TEMPLATE, README_TEMPLATE } from "./templates";
import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

export interface ScaffoldOptions {
    type: "command" | "prompt";
    name: string;
    overwrite?: boolean;
}

export async function executeScaffold(options: ScaffoldOptions, bus?: any) {
    const traceId = createTraceId();
    const startTime = Date.now();
    const results: string[] = [];

    if (options.type === "command") {
        const featureDir = join(process.cwd(), "src/features", options.name);
        await mkdir(featureDir, { recursive: true });

        const files = [
            { path: join(featureDir, "cli.ts"), content: CLI_TEMPLATE(options.name) },
            { path: join(featureDir, "execute.ts"), content: EXECUTE_TEMPLATE(options.name) },
            { path: join(featureDir, "execute.test.ts"), content: TEST_TEMPLATE(options.name) },
            { path: join(featureDir, "README.md"), content: README_TEMPLATE(options.name) },
        ];

        for (const file of files) {
            await writeFile(file.path, file.content, { flag: options.overwrite ? "w" : "wx" });
            results.push(file.path);
        }
    } else if (options.type === "prompt") {
        const promptPath = join(process.cwd(), "src/features/prompt/templates", `${options.name}.md`);
        await writeFile(promptPath, PROMPT_TEMPLATE(options.name), { flag: options.overwrite ? "w" : "wx" });
        results.push(promptPath);
    }

    telemetry.track({
        event: "scaffold.success",
        level: "info",
        success: true,
        duration_ms: Date.now() - startTime,
        trace_id: traceId,
        metadata: {
            type: options.type,
            name: options.name,
            files_created: results.length
        }
    }, bus);

    return { results, traceId };
}
