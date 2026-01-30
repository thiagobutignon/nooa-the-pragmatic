export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	level: LogLevel;
	event: string;
	timestamp: number;
	trace_id?: string;
	message?: string;
	metadata?: Record<string, unknown>;
}

export type LoggerContext = Record<string, unknown> & {
	trace_id?: string;
};

const TRACE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createTraceId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	let out = "t-";
	for (let i = 0; i < 16; i += 1) {
		out += TRACE_ALPHABET[Math.floor(Math.random() * TRACE_ALPHABET.length)];
	}
	return out;
}

export class Logger {
	private context: LoggerContext = {};

	setContext(ctx: LoggerContext) {
		this.context = { ...this.context, ...ctx };
	}

	clearContext(keys?: string[]) {
		if (!keys) {
			this.context = {};
			return;
		}
		for (const key of keys) {
			delete this.context[key];
		}
	}

	debug(event: string, metadata?: Record<string, unknown>, message?: string) {
		this.log("debug", event, metadata, message);
	}

	info(event: string, metadata?: Record<string, unknown>, message?: string) {
		this.log("info", event, metadata, message);
	}

	warn(event: string, metadata?: Record<string, unknown>, message?: string) {
		this.log("warn", event, metadata, message);
	}

	error(
		event: string,
		error: Error,
		metadata?: Record<string, unknown>,
	) {
		this.log("error", event, {
			...metadata,
			error_message: error.message,
			error_stack: error.stack,
		});
	}

	private log(
		level: LogLevel,
		event: string,
		metadata?: Record<string, unknown>,
		message?: string,
	) {
		const entry: LogEntry = {
			level,
			event,
			timestamp: Date.now(),
			...this.context,
		};

		if (message) entry.message = message;
		if (metadata && Object.keys(metadata).length > 0) entry.metadata = metadata;

		process.stderr.write(`${JSON.stringify(entry)}\n`);
	}
}

export function createLogger() {
	return new Logger();
}

export const logger = createLogger();
