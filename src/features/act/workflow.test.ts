import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../../core/event-bus";
import { run } from "./cli";

describe("act workflow integration", () => {
	let originalCwd = "";
	let tmpRoot = "";

	beforeEach(() => {
		originalCwd = process.cwd();
		tmpRoot = mkdtempSync(join(tmpdir(), "nooa-act-workflow-"));
		process.chdir(tmpRoot);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("fails when workflow spec gate is missing and emits workflow events", async () => {
		const bus = new EventBus();
		const events: string[] = [];

		bus.on("workflow.started", (evt) => events.push((evt as { type: string }).type));
		bus.on("workflow.step.start", (evt) => events.push((evt as { type: string }).type));
		bus.on("workflow.gate.fail", (evt) => events.push((evt as { type: string }).type));
		bus.on("workflow.completed", (evt) => events.push((evt as { type: string }).type));

		const result = await run({ goal: "test workflow", bus });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("act.runtime_error");
			expect(result.error.message).toContain("Spec missing");
		}
		expect(events).toContain("workflow.started");
		expect(events).toContain("workflow.step.start");
		expect(events).toContain("workflow.gate.fail");
		expect(events).toContain("workflow.completed");
	});
});
