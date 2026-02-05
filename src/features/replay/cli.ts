import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";
import { loadReplay, saveReplay } from "./storage";

export const replayMeta: AgentDocMeta = {
    name: "replay",
    description: "New feature: replay",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const replayHelp = `
Usage: nooa replay <input> [flags]

Describe what replay does.

Arguments:
  <input>     Input value.

Flags:
  --json      Output result as JSON.
  -h, --help  Show help message.

Examples:
  nooa replay hello
  nooa replay hello --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing input)
`;

export const replaySdkUsage = `
SDK Usage:
  const result = await replay.run({ input: "hello" });
  if (result.ok) {
    console.log(result.data.message);
  }
`;

export const replayUsage = {
    cli: "nooa replay <input> [--json]",
    sdk: "await replay.run({ input: \"hello\" })",
    tui: "ReplayDialog()",
};

export const replaySchema = {
    action: { type: "string", required: true },
    label: { type: "string", required: false },
    from: { type: "string", required: false },
    to: { type: "string", required: false },
    targetId: { type: "string", required: false },
    root: { type: "string", required: false },
    json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const replayOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "traceId", type: "string" },
    { name: "message", type: "string" },
];

export const replayErrors = [
    { code: "replay.missing_action", message: "Action is required." },
    { code: "replay.missing_input", message: "Input is required." },
    { code: "replay.missing_from", message: "From id is required." },
    { code: "replay.missing_to", message: "To id is required." },
    { code: "replay.missing_target", message: "Target id is required." },
    { code: "replay.not_found", message: "Node not found." },
    { code: "replay.cycle_detected", message: "Cycle detected." },
    { code: "replay.runtime_error", message: "Unexpected error." },
];

export const replayExitCodes = [
    { value: "0", description: "Success" },
    { value: "1", description: "Runtime error" },
    { value: "2", description: "Validation error" },
];

export const replayExamples = [
    { input: "nooa replay hello", output: "Success output" },
    { input: "nooa replay hello --json", output: "{ ... }" },
];

export interface ReplayRunInput {
    action?: string;
    label?: string;
    from?: string;
    to?: string;
    targetId?: string;
    root?: string;
    json?: boolean;
}

export interface ReplayRunResult {
    ok: boolean;
    traceId: string;
    message: string;
}

export async function run(
    input: ReplayRunInput,
): Promise<SdkResult<ReplayRunResult>> {
    if (!input.action) {
        return {
            ok: false,
            error: sdkError("replay.missing_action", "Action is required."),
        };
    }
    if (input.action === "add" && !input.label) {
        return {
            ok: false,
            error: sdkError("replay.missing_input", "Input is required."),
        };
    }
    if (input.action === "link") {
        if (!input.from) {
            return {
                ok: false,
                error: sdkError("replay.missing_from", "From id is required."),
            };
        }
        if (!input.to) {
            return {
                ok: false,
                error: sdkError("replay.missing_to", "To id is required."),
            };
        }
    }
    if (input.action === "fix") {
        if (!input.targetId) {
            return {
                ok: false,
                error: sdkError("replay.missing_target", "Target id is required."),
            };
        }
        if (!input.label) {
            return {
                ok: false,
                error: sdkError("replay.missing_input", "Input is required."),
            };
        }
    }

    const traceId = createTraceId();
    if (input.action === "add") {
        const root = input.root ?? process.cwd();
        const data = await loadReplay(root);
        const node = {
            id: createTraceId(),
            label: input.label ?? "",
            type: "step" as const,
            createdAt: new Date().toISOString(),
        };
        data.nodes.push(node);
        await saveReplay(root, data);
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                message: `Added ${node.id}`,
            },
        };
    }
    if (input.action === "link") {
        const root = input.root ?? process.cwd();
        const data = await loadReplay(root);
        const from = input.from ?? "";
        const to = input.to ?? "";

        const fromExists = data.nodes.some((node) => node.id === from);
        const toExists = data.nodes.some((node) => node.id === to);
        if (!fromExists || !toExists) {
            return {
                ok: false,
                error: sdkError("replay.not_found", "Node not found."),
            };
        }

        const nextEdges = data.edges.filter((edge) => edge.kind === "next");
        const adjacency = new Map<string, string[]>();
        for (const edge of nextEdges) {
            if (!adjacency.has(edge.from)) {
                adjacency.set(edge.from, []);
            }
            adjacency.get(edge.from)?.push(edge.to);
        }

        const stack = [to];
        const visited = new Set<string>();
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || visited.has(current)) continue;
            if (current === from) {
                return {
                    ok: false,
                    error: sdkError("replay.cycle_detected", "Cycle detected."),
                };
            }
            visited.add(current);
            const neighbors = adjacency.get(current) ?? [];
            neighbors.forEach((neighbor) => stack.push(neighbor));
        }

        data.edges.push({ from, to, kind: "next" });
        await saveReplay(root, data);
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                message: `Linked ${from} -> ${to}`,
            },
        };
    }
    if (input.action === "fix") {
        const root = input.root ?? process.cwd();
        const data = await loadReplay(root);
        const targetId = input.targetId ?? "";

        const targetExists = data.nodes.some((node) => node.id === targetId);
        if (!targetExists) {
            return {
                ok: false,
                error: sdkError("replay.not_found", "Node not found."),
            };
        }

        const fixNode = {
            id: createTraceId(),
            label: input.label ?? "",
            type: "fix" as const,
            createdAt: new Date().toISOString(),
            fixOf: targetId,
        };
        data.nodes.push(fixNode);

        const nextEdges = data.edges.filter((edge) => edge.kind === "next");
        const adjacency = new Map<string, string[]>();
        for (const edge of nextEdges) {
            if (!adjacency.has(edge.from)) {
                adjacency.set(edge.from, []);
            }
            adjacency.get(edge.from)?.push(edge.to);
        }

        const impacted = new Set<string>();
        const stack = [targetId];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) continue;
            const neighbors = adjacency.get(current) ?? [];
            for (const neighbor of neighbors) {
                if (!impacted.has(neighbor)) {
                    impacted.add(neighbor);
                    stack.push(neighbor);
                }
            }
        }

        impacted.forEach((nodeId) => {
            data.edges.push({ from: fixNode.id, to: nodeId, kind: "impact" });
        });
        await saveReplay(root, data);
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                message: `Fixed ${targetId}`,
            },
        };
    }

    return {
        ok: false,
        error: sdkError("replay.runtime_error", "Unexpected error."),
    };
}

const replayBuilder = new CommandBuilder<ReplayRunInput, ReplayRunResult>()
    .meta(replayMeta)
    .usage(replayUsage)
    .schema(replaySchema)
    .help(replayHelp)
    .sdkUsage(replaySdkUsage)
    .outputFields(replayOutputFields)
    .examples(replayExamples)
    .errors(replayErrors)
    .exitCodes(replayExitCodes)
    .options({ options: buildStandardOptions() })
    .parseInput(async ({ positionals, values }) => ({
        action: positionals[1],
        label: positionals[2],
        from: positionals[2],
        to: positionals[3],
        targetId: positionals[2],
        root: typeof values.root === "string" ? values.root : undefined,
        json: Boolean(values.json),
    }))
    .run(run)
    .onSuccess((output, values) => {
        if (values.json) {
            renderJson(output);
            return;
        }
        console.log(output.message);
    })
    .onFailure((error) => {
        handleCommandError(error, ["replay.missing_input"]);
    })
    .telemetry({
        eventPrefix: "replay",
        successMetadata: (input) => ({ input: input.input }),
        failureMetadata: (input, error) => ({ input: input.input, error: error.message }),
    });

export const replayAgentDoc = replayBuilder.buildAgentDoc(false);
export const replayFeatureDoc = (includeChangelog: boolean) =>
    replayBuilder.buildFeatureDoc(includeChangelog);

const replayCommand = replayBuilder.build();

export default replayCommand;
