export const CLI_TEMPLATE = (name: string) => `import { parseArgs } from "node:util";
import { execute${name.charAt(0).toUpperCase() + name.slice(1)} } from "./execute";
import { logger } from "../../core/logger";

export async function ${name}Cli(args: string[]) {
    const { values, positionals } = parseArgs({
        args,
        options: {
            json: { type: "boolean" },
            // Add your custom flags here
        },
        allowPositionals: true,
        strict: false
    });

    try {
        const { result, traceId } = await execute${name.charAt(0).toUpperCase() + name.slice(1)}({
            json: values.json,
            // Pass flags here
        });

        if (values.json) {
            console.log(JSON.stringify({
                schemaVersion: "1.0",
                ok: true,
                traceId,
                command: "${name}",
                timestamp: new Date().toISOString(),
                ...result
            }, null, 2));
        } else {
            // Provide human-readable output
            console.log(\`Successfully executed ${name} (\${traceId})\`);
        }
    } catch (e) {
        logger.error("${name}.error", e as Error);
        process.exitCode = 1;
    }
}

const ${name}Command = {
    name: "${name}",
    description: "New feature: ${name}",
    async execute({ rawArgs, bus }: any) {
        const index = rawArgs.indexOf("${name}");
        await ${name}Cli(rawArgs.slice(index + 1));
    }
};

export default ${name}Command;
`;

export const EXECUTE_TEMPLATE = (name: string) => `import { createTraceId } from "../../core/logger";
import { telemetry } from "../../core/telemetry";

export interface ${name.charAt(0).toUpperCase() + name.slice(1)}Options {
    json?: boolean;
    // Add custom options
}

export async function execute${name.charAt(0).toUpperCase() + name.slice(1)}(options: ${name.charAt(0).toUpperCase() + name.slice(1)}Options, bus?: any) {
    const traceId = createTraceId();
    const startTime = Date.now();

    // 1. Core Logic
    const result = {
        message: "Action performed by ${name}"
    };

    // 2. Telemetry
    telemetry.track({
        event: "${name}.success",
        level: "info",
        success: true,
        duration_ms: Date.now() - startTime,
        trace_id: traceId,
        metadata: {
            json: !!options.json
        }
    }, bus);

    return { result, traceId };
}
`;

export const TEST_TEMPLATE = (name: string) => `import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { execute${name.charAt(0).toUpperCase() + name.slice(1)} } from "./execute";

describe("execute${name.charAt(0).toUpperCase() + name.slice(1)}", () => {
    let originalProvider: string | undefined;

    beforeEach(() => {
        originalProvider = process.env.NOOA_AI_PROVIDER;
        process.env.NOOA_AI_PROVIDER = "mock";
    });

    afterEach(() => {
        if (originalProvider) {
            process.env.NOOA_AI_PROVIDER = originalProvider;
        } else {
            delete process.env.NOOA_AI_PROVIDER;
        }
    });

    it("should execute successfully", async () => {
        const { result, traceId } = await execute${name.charAt(0).toUpperCase() + name.slice(1)}({
            json: true
        });

        expect(traceId).toBeDefined();
        expect(result.message).toBe("Action performed by ${name}");
    });
});
`;

export const PROMPT_TEMPLATE = (name: string) => `---
name: ${name}
version: 1.0.0
description: AI assistant for ${name}
output: json
temperature: 0.1
---

# ${name.toUpperCase()} Prompt

You are an expert AI assistant designed for ${name}.

## Golden Rules (No Hallucinations)
- Only report facts or issues you can identify in the provided input.
- If unsure, state it clearly.
- Follow the project conventions strictly.

## Strict Categories
Use only these categories:
- bug
- style
- arch
- security
- observability
- test

## Evidence Requirement
For any medium or high severity finding, provide exact identifier names and failure scenarios.

## Output (STRICT JSON)
Schema:
{
  "ok": boolean,
  "summary": "string",
  "findings": [
    {
      "severity": "low" | "medium" | "high",
      "category": "string",
      "message": "string",
      "suggestion": "string"
    }
  ]
}

## Context
Project Root: {{repo_root}}
Input Data:
{{input}}
`;

export const README_TEMPLATE = (name: string) => `# ${name.charAt(0).toUpperCase() + name.slice(1)} Feature

This feature implements ${name} for the NOOA CLI.

## Usage
\`bash
nooa ${name} [flags]
\`

## Options
- \`--json\`: Output results in structured JSON format.
`;
