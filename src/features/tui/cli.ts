import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { buildStandardOptions } from "../../core/cli-flags";

export const tuiMeta: AgentDocMeta = {
    name: "tui",
    description: "Launch terminal user interfaces",
    changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const tuiHelp = `
Usage: nooa tui [flags]

Navigate the NOOA Agentic System via TUI.

Flags:
  --dashboard       Show the Hypergrowth Dashboard (default).
  --tail            Show the raw event tail log.
  -h, --help        Show help message.

Examples:
  nooa tui
  nooa tui --tail
`;

export const tuiExamples = [
    { input: "nooa tui", output: "Launch the interactive dashboard interface." },
    { input: "nooa tui --tail", output: "View the live event tail log." },
];

export const tuiSchema = {
    dashboard: { type: "boolean", required: false },
    tail: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const tuiUsage = {
    cli: "nooa tui [flags]",
};

export interface TuiInput {
    dashboard?: boolean;
    tail?: boolean;
}

export async function run(input: TuiInput): Promise<SdkResult<void>> {
    // Dynamic import of Ink components to avoid TUI init on simple CLI commands?
    // Usually fine, but good practice if they have side effects.
    const { render } = await import("ink");
    const React = await import("react");

    if (input.tail) {
        const { TailApp } = await import("../../tui/tail");
        // @ts-ignore - Ink types might be mismatching in direct usage
        render(React.createElement(TailApp));
    } else {
        // Default to dashboard
        const { DashboardView } = await import("../../tui/dashboard");
        // @ts-ignore
        render(React.createElement(DashboardView));
    }

    // Keep process alive? Ink handles this usually.
    // However, the command runner might exit if we return.
    // We return a promise that doesn't resolve? 
    // Or we return and let Ink handle lifecycle.
    // If we return, the main loop finishes. 
    // But Ink usually holds the process open until exit() is called.

    return { ok: true, data: undefined };
}

const tuiBuilder = new CommandBuilder<TuiInput, void>()
    .meta(tuiMeta)
    .usage(tuiUsage)
    .schema(tuiSchema)
    .help(tuiHelp)
    .sdkUsage("await tui.run({})")
    .examples(tuiExamples)
    .options({
        options: {
            ...buildStandardOptions(),
            dashboard: { type: "boolean" },
            tail: { type: "boolean" },
        },
    })
    .parseInput(async ({ values }) => ({
        dashboard: Boolean(values.dashboard),
        tail: Boolean(values.tail),
    }))
    .run(run);

export const command = tuiBuilder.build();
export default command;
