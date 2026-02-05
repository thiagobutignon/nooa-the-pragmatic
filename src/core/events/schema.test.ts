import { describe, expect, it } from "bun:test";
import type { NOOAEvent } from "./schema";

describe("Event schema", () => {
	it("is a closed union", () => {
		const evt: NOOAEvent = {
			type: "workflow.started",
			traceId: "t",
			goal: "x",
		};
		expect(evt.type).toBe("workflow.started");
	});
});
