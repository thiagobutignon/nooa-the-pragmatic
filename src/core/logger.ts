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

type LogWriter = (line: string) => void;

export class Logger {
	private storage?: AsyncLocalStorage<LoggerContext>;
	private write: LogWriter;
	private context: LoggerContext = {};

	constructor(
		writer: LogWriter = (line) => {
			process.stderr.write(line);
		},
		useAsyncStorage = true,
	) {
		this.write = writer;
		if (useAsyncStorage) {
			this.storage = new AsyncLocalStorage<LoggerContext>();
		}
	}

	setContext(ctx: LoggerContext) {
		if (this.storage) {
			const current = this.storage.getStore();
			if (current) {
				this.storage.enterWith({ ...current, ...ctx });
				return;
			}
		}
		this.context = { ...this.context, ...ctx };
	}

	clearContext(_keys?: string[]) {
		if (this.storage) {
			if (this.storage.getStore()) {
				// AsyncLocalStorage doesn't support partial clearing easily in one-shot
				// but we can enter an empty store.
				this.storage.enterWith({});
				return;
			}
		}
		this.context = {};
	}

	runWithContext<T>(ctx: LoggerContext, fn: () => T): T {
		if (this.storage) return this.storage.run(ctx, fn);
		const previous = this.context;
		this.context = ctx;
		try {
			return fn();
		} finally {
			this.context = previous;
		}
	}

	getContext(): LoggerContext {
		if (this.storage) return this.storage.getStore() || {};
		return this.context;
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
			...(this.storage ? this.storage.getStore() || {} : this.context),
		};

		if (message) entry.message = message;
		if (metadata && Object.keys(metadata).length > 0) entry.metadata = metadata;

		this.write(`${JSON.stringify(entry)}\n`);
	}
}

export function createLogger(
	options?: LogWriter | { writer?: LogWriter; useAsyncStorage?: boolean },
) {
	if (typeof options === "function" || options === undefined) {
		return new Logger(options);
	}
	return new Logger(options.writer, options.useAsyncStorage);
}

export const logger = createLogger();
