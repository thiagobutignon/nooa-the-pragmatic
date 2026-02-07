import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult, type AgentDocMeta } from "../../core/types";
import type { ReplayEdge, ReplayNode } from "./storage";
import { loadReplay, saveReplay } from "./storage";
import { ReplayGraph } from "./graph";

export const replayMeta: AgentDocMeta = {
    name: "replay",
    description: "Track agent steps as a replayable graph",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const replayHelp = `
Usage: nooa replay <subcommand> [args] [flags]

Track a step graph and fixes for agent workflows.

Subcommands:
  add <label>                Create a step node.
  link <from> <to>           Create a next edge.
  fix <targetId> <label>     Create a fix node and impact edges.
  show [id]                  Show graph summary or node details.

Flags:
  --json      Output result as JSON.
  --root      Override repository root (default: cwd).
  -h, --help  Show help message.

Examples:
  nooa replay add A
  nooa replay link node_a node_b
  nooa replay fix node_b "Fix B"
  nooa replay show --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error
`;

export const replaySdkUsage = `
SDK Usage:
  const result = await replay.run({ action: "add", label: "A" });
  if (result.ok) {
    console.log(result.data.node);
  }
`;

export const replayUsage = {
    cli: "nooa replay <subcommand> [args] [--json]",
    sdk: "await replay.run({ action: \"add\", label: \"A\" })",
    tui: "ReplayDialog()",
};

export const replaySchema = {
    action: { type: "string", required: true },
    label: { type: "string", required: false },
    from: { type: "string", required: false },
    to: { type: "string", required: false },
    targetId: { type: "string", required: false },
    id: { type: "string", required: false },
    root: { type: "string", required: false },
    json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const replayOutputFields = [
    { name: "ok", type: "boolean" },
    { name: "traceId", type: "string" },
    { name: "node", type: "string" },
    { name: "edge", type: "string" },
    { name: "summary", type: "string" },
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
    { input: "nooa replay add A", output: "Add a new step node labeled 'A' to the replay graph." },
    { input: "nooa replay link node_a node_b", output: "Create a 'next' link from node_a to node_b." },
    { input: "nooa replay fix node_b \"Fix B\"", output: "Register a fix for node_b with label 'Fix B'." },
    { input: "nooa replay show --json", output: "Show the current replay graph in JSON format." },
];

export interface ReplayRunInput {
    action?: string;
    label?: string;
    from?: string;
    to?: string;
    targetId?: string;
    id?: string;
    root?: string;
    json?: boolean;
}

export interface ReplayRunResult {
    ok: boolean;
    traceId: string;
    node?: ReplayNode;
    edge?: ReplayEdge;
    summary?: {
        nodes: number;
        edges: number;
    };
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
    const root = input.root ?? process.cwd();
    const data = await loadReplay(root);
    const graph = new ReplayGraph(data);

    if (input.action === "add") {
        const node = graph.addNode(input.label ?? "", "step");
        await saveReplay(root, graph.toJSON());
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                node,
            },
        };
    }
    if (input.action === "link") {
        const from = input.from ?? "";
        const to = input.to ?? "";
        try {
            graph.addEdge(from, to, "next");
            await saveReplay(root, graph.toJSON());
            return {
                ok: true,
                data: {
                    ok: true,
                    traceId,
                    edge: { from, to, kind: "next" },
                },
            };
        } catch (e: any) {
            const code = e.message.includes("Cycle") ? "replay.cycle_detected" : "replay.not_found";
            return {
                ok: false,
                error: sdkError(code, e.message),
            };
        }
    }
    if (input.action === "fix") {
        try {
            const fixNode = graph.addFix(input.targetId ?? "", input.label ?? "");
            await saveReplay(root, graph.toJSON());
            return {
                ok: true,
                data: {
                    ok: true,
                    traceId,
                    node: fixNode,
                },
            };
        } catch (e: any) {
            return {
                ok: false,
                error: sdkError("replay.not_found", e.message),
            };
        }
    }
    if (input.action === "show") {
        if (input.id) {
            const node = graph.getNode(input.id);
            if (!node) {
                return {
                    ok: false,
                    error: sdkError("replay.not_found", "Node not found."),
                };
            }
            return {
                ok: true,
                data: {
                    ok: true,
                    traceId,
                    node,
                    summary: graph.getSummary(),
                },
            };
        }
        return {
            ok: true,
            data: {
                ok: true,
                traceId,
                summary: graph.getSummary(),
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
    .options({
        options: {
            ...buildStandardOptions(),
            root: { type: "string" },
        },
    })
    .parseInput(async ({ positionals, values }) => {
        const action = positionals[1];
        const root = typeof values.root === "string" ? values.root : undefined;

        if (action === "add") {
            return {
                action,
                label: positionals[2],
                root,
                json: Boolean(values.json),
            };
        }

        if (action === "link") {
            return {
                action,
                from: positionals[2],
                to: positionals[3],
                root,
                json: Boolean(values.json),
            };
        }

        if (action === "fix") {
            return {
                action,
                targetId: positionals[2],
                label: positionals[3],
                root,
                json: Boolean(values.json),
            };
        }

        if (action === "show") {
            return {
                action,
                id: positionals[2],
                root,
                json: Boolean(values.json),
            };
        }

        return {
            action,
            root,
            json: Boolean(values.json),
        };
    })
    .run(run)
    .onSuccess((output, values) => {
        if (values.json) {
            renderJson(output);
            return;
        }
        if (output.node) {
            if (output.node.type === "fix") {
                console.log(`Created fix node ${output.node.id}`);
                return;
            }
            console.log(`Created node ${output.node.id}`);
            return;
        }
        if (output.edge) {
            console.log(`Linked ${output.edge.from} -> ${output.edge.to} (${output.edge.kind})`);
            return;
        }
        if (output.summary) {
            console.log(`Nodes: ${output.summary.nodes}, Edges: ${output.summary.edges}`);
            return;
        }
        console.log("OK");
    })
    .onFailure((error) => {
        handleCommandError(error, ["replay.missing_input"]);
    })
    .telemetry({
        eventPrefix: "replay",
        successMetadata: (input) => ({ action: input.action }),
        failureMetadata: (input, error) => ({ action: input.action, error: error.message }),
    });

export const replayAgentDoc = replayBuilder.buildAgentDoc(false);
export const replayFeatureDoc = (includeChangelog: boolean) =>
    replayBuilder.buildFeatureDoc(includeChangelog);

const replayCommand = replayBuilder.build();

export default replayCommand;
