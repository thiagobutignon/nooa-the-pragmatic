import type { Command, CommandContext } from "../../core/command";

const messageHelp = `
Usage: nooa message <text>

Send a message to the AI agent.

Arguments:
  <text>         The message content (required)

Flags:
  --role <type>  Message role: user, system, assistant (default: user)
  --json         Output in JSON format
  -h, --help     Show this help message

Examples:
  nooa message "Hello, how are you?"
  nooa message "Initialize system" --role system
  nooa message "Summarize this" --json
`;

const messageCommand: Command = {
    name: "message",
    description: "Send a message to the AI agent",
    options: {
        role: { type: "string" },
        json: { type: "boolean" },
    },
    execute: async ({ rawArgs }: CommandContext) => {
        const { parseArgs } = await import("node:util");
        const { values } = parseArgs({
            args: rawArgs,
            options: {
                ...messageCommand.options,
                help: { type: "boolean", short: "h" },
            },
            strict: true,
            allowPositionals: true,
        }) as any;

        if (values.help) {
            console.log(messageHelp);
            return;
        }

        // TBD: Other logic will be implemented in Task 2 and 3
    },
};

export default messageCommand;
