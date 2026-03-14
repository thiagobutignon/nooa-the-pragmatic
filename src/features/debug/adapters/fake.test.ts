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

	test("pause transitions a running session into paused state", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: false });

		const snapshot = await adapter.pause();
		expect(snapshot.state).toBe("paused");
		expect(snapshot.location?.line).toBe(2);
		expect(snapshot.source?.length).toBeGreaterThan(0);
	});

	test("getProperties expands nested values by object id", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const vars = await adapter.getVars();
		const bar = vars.find((value) => value.name === "bar");
		expect(bar?.id).toBe("obj:bar");

		const props = await adapter.getProperties(bar?.id ?? "");
		expect(props).toHaveLength(2);
		expect(props[0]?.name).toBe("nested");
		expect(props[0]?.scope).toBe("local");
	});

	test("getPropertiesFromExpression expands nested values on one call", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const props = await adapter.getPropertiesFromExpression("bar");
		expect(props).toHaveLength(2);
		expect(props[1]?.name).toBe("count");
	});

	test("getConsole returns recent fake console output", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const entries = await adapter.getConsole();
		expect(entries[0]?.level).toBe("log");
		expect(entries[0]?.text).toContain("fake console");
	});

	test("getScripts returns loaded fake scripts", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const scripts = await adapter.getScripts();
		expect(scripts[0]?.url).toContain("app.js");
		expect(scripts.length).toBeGreaterThan(1);
	});

	test("eval returns a compact value payload", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const result = await adapter.evaluate({ expression: "typeof foo" });
		expect(result.ref).toBe("@v3");
		expect(result.value).toBe('"fake:typeof foo"');
	});

	test("eval exposes expandable object refs when available", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const result = await adapter.evaluate({ expression: "bar" });
		expect(result.id).toBe("obj:bar");
		expect(result.value).toBe("{ nested: true }");
	});

	test("setValue updates a tracked expression and returns the new value", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		const result = await adapter.setValue({
			target: "bar.count",
			value: "7",
		});

		expect(result.value).toBe("7");

		const next = await adapter.evaluate({ expression: "bar.count" });
		expect(next.value).toBe("7");
	});

	test("stop resets the adapter to idle", async () => {
		const adapter = createFakeDebugAdapter("node");
		await adapter.launch({ command: ["node", "app.js"], brk: true });

		await adapter.stop();
		const status = await adapter.status();
		expect(status.state).toBe("idle");
	});
});
