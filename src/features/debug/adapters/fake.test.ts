import { describe, expect, test } from "bun:test";
import { createFakeDebugAdapter } from "./fake";

describe("fake debug adapter", () => {
	test("launch transitions adapter into paused state when brk is true", async () => {
		const adapter = createFakeDebugAdapter("node");
		const result = await adapter.launch({
			command: ["node", "app.js"],
			brk: true,
		});

		expect(result.runtime).toBe("node");
		expect(result.state).toBe("paused");
		expect(result.target.command).toEqual(["node", "app.js"]);
		expect(result.location?.line).toBe(1);
	});

	test("status returns the last known state", async () => {
		const adapter = createFakeDebugAdapter("bun");
		await adapter.launch({ command: ["bun", "app.ts"], brk: false });

		const status = await adapter.status();
		expect(status.runtime).toBe("bun");
		expect(status.state).toBe("running");
	});

	test("setBreakpoint records breakpoints with stable refs", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const bp = await adapter.setBreakpoint({
			file: "src/app.ts",
			line: 42,
		});

		expect(bp.ref).toBe("BP#1");
		expect(bp.file).toBe("src/app.ts");
		expect(bp.line).toBe(42);

		const list = await adapter.listBreakpoints();
		expect(list).toHaveLength(1);
		expect(list[0]?.ref).toBe("BP#1");
	});

	test("continue invalidates paused state", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		await adapter.continue();
		const status = await adapter.status();

		expect(status.state).toBe("running");
		expect(status.location).toBeUndefined();
	});

	test("buildState returns source vars and stack when paused", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const snapshot = await adapter.buildState();
		expect(snapshot.state).toBe("paused");
		expect(snapshot.source?.length).toBeGreaterThan(0);
		expect(snapshot.vars?.[0]?.ref).toBe("@v1");
		expect(snapshot.stack?.[0]?.ref).toBe("@f0");
	});

	test("eval returns a compact value payload", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const result = await adapter.evaluate({ expression: "typeof foo" });
		expect(result.ref).toBe("@v3");
		expect(result.value).toBe('"fake:typeof foo"');
	});

	test("stop resets the adapter to idle", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		await adapter.stop();
		const status = await adapter.status();
		expect(status.state).toBe("idle");
	});
});
