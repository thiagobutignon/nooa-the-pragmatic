import type { EventBus } from "../../core/event-bus";
import { telemetry } from "../../core/telemetry";
import type { Message, MessageOptions } from "./types";

export async function executeMessage(
	content: string,
	options: MessageOptions,
	bus?: EventBus,
): Promise<Message> {
	const message: Message = {
		role: options.role,
		content,
		timestamp: new Date().toISOString(),
	};

	await telemetry.track(
		{
			event: "message.received",
			level: "info",
			success: true,
			duration_ms: 0,
			metadata: {
				role: message.role,
				contentLength: message.content.length,
			},
		},
		bus,
	);

	return message;
}

export function formatOutput(message: Message, json: boolean): string {
	if (json) {
		return JSON.stringify(message, null, 2);
	}

	return `[${message.role}] ${message.content}`;
}
