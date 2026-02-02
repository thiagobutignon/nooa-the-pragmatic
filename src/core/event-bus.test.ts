import { describe, expect, test } from "bun:test";
import { EventBus } from "./event-bus";

describe("EventBus", () => {
	test("publishes events to subscribers", () => {
		const bus = new EventBus();
		const events: string[] = [];
		bus.on("test.event", (payload: { id: string }) => events.push(payload.id));
		bus.emit("test.event", { id: "1" });
		expect(events).toEqual(["1"]);
	});

	test("unsubscribes from events", () => {
		const bus = new EventBus();
		const events: string[] = [];
		const handler = (payload: { id: string }) => events.push(payload.id);

		bus.on("test", handler);
		bus.emit("test", { id: "1" });
		bus.off("test", handler);
		bus.emit("test", { id: "2" });

		expect(events).toEqual(["1"]);
	});

	test("handles off with non-existent event", () => {
		const bus = new EventBus();
		bus.off("missing", () => {}); // Should not throw
	});

	test("handles emit with no subscribers", () => {
		const bus = new EventBus();
		bus.emit("missing", {}); // Should not throw
	});
});
