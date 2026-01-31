import { parse } from "shell-quote";
import type { PipelineStep } from "./types";

export function parsePipelineArgs(args: string[]): PipelineStep[] {
    // Heuristic: if we find "--", we assume delimiter mode.
    // Otherwise, if args look like separate command strings, we parse them.
    const hasDelimiter = args.includes("--");

    if (hasDelimiter) {
        return parseDelimiterMode(args);
    }

    return parseStringMode(args);
}

function parseDelimiterMode(args: string[]): PipelineStep[] {
    const steps: PipelineStep[] = [];
    let currentArgv: string[] = [];

    for (const arg of args) {
        if (arg === "--") {
            if (currentArgv.length > 0) {
                steps.push(createStep(currentArgv));
                currentArgv = [];
            }
        } else {
            currentArgv.push(arg);
        }
    }

    if (currentArgv.length > 0) {
        steps.push(createStep(currentArgv));
    }

    return steps;
}

function parseStringMode(args: string[]): PipelineStep[] {
    return args.map((arg) => {
        const parsed = parse(arg);
        // shell-quote can return objects for operators, we only want strings here for now
        const argv = parsed.filter((p): p is string => typeof p === "string");
        return createStep(argv, arg);
    });
}

function createStep(argv: string[], original?: string): PipelineStep {
    // Unescape literal delimiters \-- -> --
    const unescapedArgv = argv.map(arg => arg === "\\--" ? "--" : arg);
    const rawOriginal = original ?? argv.join(" ");

    // Policy: explicit 'exec' prefix forces external
    if (unescapedArgv[0] === "exec") {
        return {
            kind: "external",
            argv: unescapedArgv.slice(1),
            original: rawOriginal,
        };
    }

    // Policy: 'nooa' prefix is optional for internal commands
    if (unescapedArgv[0] === "nooa") {
        return {
            kind: "internal",
            argv: unescapedArgv.slice(1),
            original: rawOriginal,
        };
    }

    // Default to internal for safety (executor will validate if command exists)
    return {
        kind: "internal",
        argv: unescapedArgv,
        original: rawOriginal,
    };
}
