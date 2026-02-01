import { AsyncLocalStorage } from "node:async_hooks";

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
	private storage = new AsyncLocalStorage<LoggerContext>();

	setContext(ctx: LoggerContext) {
		const current = this.storage.getStore() || {};
		this.storage.enterWith({ ...current, ...ctx });
	}

	clearContext(_keys?: string[]) {
		// AsyncLocalStorage doesn't support partial clearing easily in one-shot
		// but we can enter an empty store.
		this.storage.enterWith({});
	}

	runWithContext<T>(ctx: LoggerContext, fn: () => T): T {
		return this.storage.run(ctx, fn);
	}

	getContext(): LoggerContext {
		return this.storage.getStore() || {};
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

	error(event: string, error: Error, metadata?: Record<string, unknown>) {
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
			...(this.storage.getStore() || {}),
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
