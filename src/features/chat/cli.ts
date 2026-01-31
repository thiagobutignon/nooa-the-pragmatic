import type { Command, CommandContext } from "../../core/command";
import type { MessageOptions, MessageRole } from "./types";

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

const VALID_ROLES: MessageRole[] = ["user", "system", "assistant"];

const messageCommand: Command = {
    name: "message",
    description: "Send a message to the AI agent",
    options: {
        role: { type: "string" },
        json: { type: "boolean" },
    },
    execute: async ({ rawArgs }: CommandContext) => {
        const { parseArgs } = await import("node:util");
        const { values, positionals } = parseArgs({
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

        const content = positionals[1];
        if (!content) {
            console.error("Error: Message text is required");
            process.exitCode = 1;
            return;
        }

        const role = (values.role || "user") as string;
        if (!VALID_ROLES.includes(role as MessageRole)) {
            console.error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`);
            process.exitCode = 1;
            return;
        }

        const options: MessageOptions = {
            role: role as MessageRole,
            json: !!values.json,
        };

        // TBD: Task 3 - Execution and Telemetry
    },
};

export default messageCommand;
