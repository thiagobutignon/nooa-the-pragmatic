import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EventBus } from "../../core/event-bus";
import fixCommand from "./cli";

describe("fix events", () => {
	let bus: EventBus;
	const events: Array<{ type: string }> = [];

	beforeEach(() => {
		bus = new EventBus();
		events.length = 0;
		bus.on("fix.started", (evt) => events.push(evt as { type: string }));
		bus.on("fix.failed", (evt) => events.push(evt as { type: string }));
	});

	afterEach(() => {
		process.exitCode = 0;
	});

	test("emits started and failed when issue is missing", async () => {
		await fixCommand.execute({
			args: ["fix"],
			rawArgs: ["fix"],
			values: {},
			bus,
		});

		expect(events.find((e) => e.type === "fix.started")).toBeTruthy();
		expect(events.find((e) => e.type === "fix.failed")).toBeTruthy();
	});
});
