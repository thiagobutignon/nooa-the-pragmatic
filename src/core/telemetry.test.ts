import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { TelemetryStore } from "./telemetry";

const TEST_DB = "telemetry-test.db";

describe("TelemetryStore", () => {
	beforeEach(() => {
		if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
	});

	afterEach(() => {
		if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
	});

	it("tracks events in sqlite", () => {
		const telemetry = new TelemetryStore(TEST_DB);
		telemetry.track({
			event: "read.success",
			level: "info",
			success: true,
			duration_ms: 12,
			trace_id: "t-1",
			metadata: { bytes: 10 },
		});

		const rows = telemetry.list({ event: "read.success" });
		expect(rows.length).toBe(1);
		if (rows.length > 0) {
			expect(rows[0].event).toBe("read.success");
		}
		telemetry.close();
	});

	it("applies limit when provided", () => {
		const telemetry = new TelemetryStore(TEST_DB);
		telemetry.track({ event: "first", level: "info", trace_id: "t1" });
		telemetry.track({ event: "second", level: "info", trace_id: "t2" });

		const rows = telemetry.list({ limit: 1 });
		expect(rows.length).toBe(1);
		telemetry.close();
	});

	it("filters by level and trace_id", () => {
		const telemetry = new TelemetryStore(TEST_DB);
		telemetry.track({ event: "a", level: "info", trace_id: "t1" });
		telemetry.track({ event: "b", level: "error", trace_id: "t2" });

		expect(telemetry.list({ level: "info" }).length).toBe(1);
		expect(telemetry.list({ trace_id: "t2" }).length).toBe(1);
		expect(telemetry.list({ level: "warn" }).length).toBe(0);
		telemetry.close();
	});

	it("reopens database if closed", () => {
		const telemetry = new TelemetryStore(TEST_DB);
		telemetry.close();
		// track should automatically reopen via ensureOpen
		telemetry.track({ event: "reopen", level: "info" });
		expect(telemetry.list({ event: "reopen" }).length).toBe(1);
		telemetry.close();
	});
});
