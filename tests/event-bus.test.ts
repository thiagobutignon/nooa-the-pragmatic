import { describe, expect, test } from "vitest";
import { EventBus } from "../src/core/event-bus";

describe("EventBus", () => {
	test("publishes events to subscribers", () => {
		const bus = new EventBus();
		const events: string[] = [];
		bus.on("test.event", (payload: { id: string }) => events.push(payload.id));
		bus.emit("test.event", { id: "1" });
		expect(events).toEqual(["1"]);
	});
});
