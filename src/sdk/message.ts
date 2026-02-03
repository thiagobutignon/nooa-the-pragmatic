import type { MessageRole } from "../features/chat/types";
import { executeMessage, formatOutput } from "../features/chat/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface MessageSendInput {
	content?: string;
	role?: MessageRole;
	json?: boolean;
}

export interface MessageSendResult {
	message: Awaited<ReturnType<typeof executeMessage>>;
	output: string;
}

const VALID_ROLES: MessageRole[] = ["user", "system", "assistant"];

export async function send(
	input: MessageSendInput,
): Promise<SdkResult<MessageSendResult>> {
	if (!input.content) {
		return {
			ok: false,
			error: sdkError("invalid_input", "content is required.")
		};
	}
	const role = input.role ?? "user";
	if (!VALID_ROLES.includes(role)) {
		return {
			ok: false,
			error: sdkError("invalid_input", "invalid role.", {
				role,
			}),
		};
	}
	try {
		const message = await executeMessage(
			input.content,
			{ role, json: Boolean(input.json) },
		);
		const output = formatOutput(message, Boolean(input.json));
		return { ok: true, data: { message, output } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("message_error", "Message failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const message = {
	send,
};
