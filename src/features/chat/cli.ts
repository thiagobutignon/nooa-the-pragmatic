import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { EventBus } from "../../core/event-bus";
import type { Message, MessageOptions, MessageRole } from "./types";

const VALID_ROLES: MessageRole[] = ["user", "system", "assistant"];

export const messageMeta: AgentDocMeta = {
	name: "message",
	description: "Send a message to the AI agent",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const messageHelp = `
Usage: nooa message <text> [flags]

Send a message to the AI agent.

Arguments:
  <text>         The message content (required).

Flags:
  --role <type>  Message role: user, system, assistant (default: user).
  --json         Output result in JSON format.
  -h, --help     Show help message.

Examples:
  nooa message "Hello, how are you?"
  nooa message "Initialize system" --role system
  nooa message "Summarize this" --json

Exit Codes:
  0: Success
  1: Runtime Error (failed execution)
  2: Validation Error (missing text or invalid role)

Error Codes:
  message.missing_text: Message text is required
  message.invalid_role: Invalid message role
  message.runtime_error: Failed to send message
`;

export const messageSdkUsage = `
SDK Usage:
  const result = await message.run({ content: "Hello", role: "user" });
  if (result.ok) console.log(result.data.output);
`;

export const messageUsage = {
	cli: "nooa message <text> [flags]",
	sdk: "await message.run({ content: \"Hello\", role: \"user\" })",
	tui: "MessageConsole()",
};

export const messageSchema = {
	content: { type: "string", required: true },
	role: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const messageOutputFields = [
	{ name: "output", type: "string" },
	{ name: "message", type: "string" },
];

export const messageErrors = [
	{ code: "message.missing_text", message: "Message text is required." },
	{ code: "message.invalid_role", message: "Invalid message role." },
	{ code: "message.runtime_error", message: "Failed to send message." },
];

export const messageExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const messageExamples = [
	{ input: "nooa message \"Hello\"", output: "Message output" },
	{ input: "nooa message \"Init\" --role system", output: "System message" },
];

export interface MessageRunInput {
	content?: string;
	role?: MessageRole;
	json?: boolean;
	bus?: EventBus;
}

export interface MessageRunResult {
	output: string;
	message: Message;
}

export async function run(
	input: MessageRunInput,
): Promise<SdkResult<MessageRunResult>> {
	if (!input.content) {
		return {
			ok: false,
			error: sdkError("message.missing_text", "Message text is required."),
		};
	}

	const role = (input.role || "user") as MessageRole;
	if (!VALID_ROLES.includes(role)) {
		return {
			ok: false,
			error: sdkError(
				"message.invalid_role",
				`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`,
			),
		};
	}

	try {
		const options: MessageOptions = {
			role,
			json: Boolean(input.json),
		};

		const { executeMessage, formatOutput } = await import("./execute");
		const message = await executeMessage(input.content, options, input.bus);
		const output = formatOutput(message, options.json);

		return {
			ok: true,
			data: { output, message },
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("message.runtime_error", message),
		};
	}
}

const messageBuilder = new CommandBuilder<MessageRunInput, MessageRunResult>()
	.meta(messageMeta)
	.usage(messageUsage)
	.schema(messageSchema)
	.help(messageHelp)
	.sdkUsage(messageSdkUsage)
	.outputFields(messageOutputFields)
	.examples(messageExamples)
	.errors(messageErrors)
	.exitCodes(messageExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			role: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values, bus }) => ({
		content: positionals[1],
		role:
			typeof values.role === "string"
				? (values.role as MessageRole)
				: "user",
			json: Boolean(values.json),
			bus,
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output.message);
			return;
		}
		console.log(output.output);
	})
	.onFailure((error) => {
		if (error.code === "message.missing_text") {
			console.error("Error: Message text is required");
			process.exitCode = 2;
			return;
		}
		if (error.code === "message.invalid_role") {
			console.error(error.message);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, ["message.missing_text", "message.invalid_role"]);
	})
	.telemetry({
		eventPrefix: "message",
		successMetadata: (_, output) => ({
			role: output.message.role,
			contentLength: output.message.content.length,
		}),
		failureMetadata: (input, error) => ({
			role: input.role,
			error: error.message,
		}),
	});

export const messageAgentDoc = messageBuilder.buildAgentDoc(false);
export const messageFeatureDoc = (includeChangelog: boolean) =>
	messageBuilder.buildFeatureDoc(includeChangelog);

const messageCommand = messageBuilder.build();

export default messageCommand;
