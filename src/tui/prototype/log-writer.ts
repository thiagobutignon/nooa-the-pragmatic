import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

export type LogEvent = {
	type: string;
	message: string;
	metadata?: Record<string, unknown>;
	timestamp?: string;
};

export function formatLogLine(event: LogEvent) {
	const payload = {
		type: event.type,
		message: event.message,
		metadata: event.metadata ?? undefined,
		timestamp: event.timestamp ?? new Date().toISOString(),
	};
	return `${JSON.stringify(payload)}\n`;
}

export async function appendLogLine(
	path: string,
	event: LogEvent,
): Promise<void> {
	await appendFile(path, formatLogLine(event), "utf-8");
}

export function resolveDefaultLogPath() {
	return resolve(process.cwd(), ".nooa/logs/tui-prototype.jsonl");
}
