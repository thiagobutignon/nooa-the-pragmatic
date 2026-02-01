import { Database } from "bun:sqlite";
import type { EventBus } from "./event-bus";

export type TelemetryLevel = "info" | "warn" | "error";

export interface TelemetryEvent {
	event: string;
	level: TelemetryLevel;
	timestamp?: number;
	duration_ms?: number;
	metadata?: Record<string, unknown>;
	trace_id?: string;
	success?: boolean;
}

export interface TelemetryRow {
	id: number;
	timestamp: number;
	event: string;
	level: string;
	duration_ms: number | null;
	metadata: string | null;
	trace_id: string | null;
	success: number | null;
}

const DEFAULT_DB_PATH = process.env.NOOA_DB_PATH || "nooa.db";

export class TelemetryStore {
	private db: Database | null = null;
	private dbPath: string;

	constructor(path: string = DEFAULT_DB_PATH) {
		this.dbPath = path;
		this.open();
	}

	private open() {
		this.db = new Database(this.dbPath);
		this.init();
	}

	private ensureOpen(): Database {
		if (!this.db) this.open();
		if (!this.db) throw new Error("Failed to open database");
		return this.db;
	}

	private init() {
		const db = this.ensureOpen();
		db.run(`
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                event TEXT NOT NULL,
                level TEXT NOT NULL,
                duration_ms INTEGER,
                metadata JSON,
                trace_id TEXT,
                success BOOLEAN
            )
        `);

		db.run("CREATE INDEX IF NOT EXISTS idx_event ON telemetry(event)");
		db.run("CREATE INDEX IF NOT EXISTS idx_timestamp ON telemetry(timestamp)");
		db.run("CREATE INDEX IF NOT EXISTS idx_trace ON telemetry(trace_id)");
	}

	track(event: TelemetryEvent, bus?: EventBus): number | bigint {
		const { logger } = require("./logger");
		const context = (logger as any).storage?.getStore() || {};
		const trace_id = event.trace_id ?? context.trace_id;

		const timestamp = event.timestamp ?? Date.now();
		const db = this.ensureOpen();
		const query = db.prepare(`
            INSERT INTO telemetry (
                timestamp, event, level, duration_ms, metadata, trace_id, success
            ) VALUES (
                $timestamp, $event, $level, $duration_ms, $metadata, $trace_id, $success
            )
        `);

		const result = query.run({
			$timestamp: timestamp,
			$event: event.event,
			$level: event.level,
			$duration_ms: event.duration_ms ?? null,
			$metadata: event.metadata ? JSON.stringify(event.metadata) : null,
			$trace_id: trace_id ?? null,
			$success: event.success === undefined ? null : event.success ? 1 : 0,
		});

		bus?.emit("telemetry.tracked", {
			...event,
			timestamp,
		});

		return result.lastInsertRowid;
	}

	list(filters: { event?: string; trace_id?: string; level?: string } = {}) {
		const db = this.ensureOpen();
		let sql = "SELECT * FROM telemetry";
		const params: Record<string, string> = {};
		const clauses: string[] = [];

		if (filters.event) {
			clauses.push("event = $event");
			params.$event = filters.event;
		}
		if (filters.trace_id) {
			clauses.push("trace_id = $trace_id");
			params.$trace_id = filters.trace_id;
		}
		if (filters.level) {
			clauses.push("level = $level");
			params.$level = filters.level;
		}

		if (clauses.length > 0) {
			sql += ` WHERE ${clauses.join(" AND ")}`;
		}

		sql += " ORDER BY timestamp DESC";
		return db.query(sql).all(params) as TelemetryRow[];
	}

	close() {
		if (this.db) this.db.close();
		this.db = null;
	}
}

export const telemetry = new TelemetryStore();
