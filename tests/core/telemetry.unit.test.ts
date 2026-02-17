import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { TelemetryStore, type TelemetryEvent } from "../../src/core/telemetry";
import { EventBus } from "../../src/core/event-bus";
import { Database } from "bun:sqlite";

describe("TelemetryStore", () => {
    let store: TelemetryStore;

    beforeEach(() => {
        // Use in-memory database for testing
        store = new TelemetryStore(":memory:");
    });

    afterEach(() => {
        store.close();
    });

    it("should initialize database tables", () => {
        // We can't easily inspect the DB directly without exposing it, 
        // but we can try to insert and query which implies tables exist.
        expect(store).toBeDefined();
    });

    it("should track events", () => {
        const event: TelemetryEvent = {
            event: "test_event",
            level: "info",
            metadata: { foo: "bar" },
            success: true
        };

        const id = store.track(event);
        expect(id).toBeDefined();

        const rows = store.list();
        expect(rows).toHaveLength(1);
        expect(rows[0].event).toBe("test_event");
        expect(rows[0].level).toBe("info");
        expect(JSON.parse(rows[0].metadata as string)).toEqual({ foo: "bar" });
        expect(rows[0].success).toBe(1);
    });

    it("should emit event if bus is provided", () => {
        const bus = new EventBus();
        let capturedEvent: any = null;

        bus.on("telemetry.tracked", (data) => {
            capturedEvent = data;
        });

        store.track({ event: "bus_test", level: "warn" }, bus);

        expect(capturedEvent).toBeDefined();
        expect(capturedEvent.event).toBe("bus_test");
        expect(capturedEvent.level).toBe("warn");
    });

    it("should filter list results", () => {
        store.track({ event: "event_a", level: "info", trace_id: "t1" });
        store.track({ event: "event_b", level: "error", trace_id: "t2" });
        store.track({ event: "event_a", level: "warn", trace_id: "t3" });

        // Filter by event
        const resEvent = store.list({ event: "event_a" });
        expect(resEvent).toHaveLength(2);
        expect(resEvent.every(r => r.event === "event_a")).toBe(true);

        // Filter by level
        const resLevel = store.list({ level: "error" });
        expect(resLevel).toHaveLength(1);
        expect(resLevel[0].event).toBe("event_b");

        // Filter by trace_id
        const resTrace = store.list({ trace_id: "t1" });
        expect(resTrace).toHaveLength(1);
        expect(resTrace[0].trace_id).toBe("t1");
    });

    it("should respect limit in list", () => {
        for (let i = 0; i < 5; i++) {
            store.track({ event: "loop", level: "info", timestamp: i }); // timestamps might be same ms, but order insert usually preserved or we can explicit timestamp
        }

        const limited = store.list({ limit: 3 });
        expect(limited).toHaveLength(3);
    });

    it("should handle close and reopen on next call (resilience)", () => {
        store.close();
        // list() calls ensureOpen() internally
        expect(() => store.list()).not.toThrow();
    });

    it("should use passed timestamp", () => {
        const now = 1234567890;
        store.track({ event: "time_test", level: "info", timestamp: now });
        const rows = store.list();
        expect(rows[0].timestamp).toBe(now);
    });

    it("should auto-generate timestamp if missing", () => {
        store.track({ event: "auto_time", level: "info" });
        const rows = store.list();
        expect(rows[0].timestamp).toBeGreaterThan(0);
    });
});
