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
		expect(rows[0].event).toBe("read.success");
		telemetry.close();
	});
});
