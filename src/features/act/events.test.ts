import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EventBus } from "../../core/event-bus";
import actCommand from "./cli";

describe("act events", () => {
	let bus: EventBus;
	const events: Array<{ type: string }> = [];

	beforeEach(() => {
		bus = new EventBus();
		events.length = 0;
		bus.on("act.started", (evt) => events.push(evt as { type: string }));
		bus.on("act.failed", (evt) => events.push(evt as { type: string }));
	});

	afterEach(() => {
		process.exitCode = 0;
	});

	test("emits failed when goal is missing", async () => {
		await actCommand.execute({
			args: ["act"],
			rawArgs: ["act"],
			values: {},
			bus,
		});

		expect(events.find((e) => e.type === "act.failed")).toBeTruthy();
	});
});
