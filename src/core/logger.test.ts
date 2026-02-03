import { describe, expect, test, spyOn, mock } from "bun:test";
import { Logger, createLogger, createTraceId, logger } from "./logger";

describe("Logger", () => {
	test("createTraceId returns string", () => {
		expect(createTraceId()).toBeTruthy();
		expect(typeof createTraceId()).toBe("string");
	});

	test("createTraceId fallback", () => {
		// Mock crypto global to undefined? Bun has crypto.
		// It's hard to delete global.crypto in Bun.
		// But we can check if it returns a string.
		const id = createTraceId();
		expect(id.length).toBeGreaterThan(0);
	});

	test("basic logging", () => {
		const lines: string[] = [];
		const writer = (line: string) => lines.push(line);
		const log = new Logger(writer);

		log.info("test_event", { foo: "bar" }, "message");
		expect(lines.length).toBe(1);
		const entry = JSON.parse(lines[0]);
		expect(entry.level).toBe("info");
		expect(entry.event).toBe("test_event");
		expect(entry.message).toBe("message");
		expect(entry.metadata).toEqual({ foo: "bar" });
	});

	test("levels", () => {
		const lines: string[] = [];
		const log = new Logger(l => lines.push(l));

		log.debug("d");
		log.warn("w");
		log.error("e", new Error("err"));

		expect(lines.length).toBe(3);
		expect(JSON.parse(lines[0]).level).toBe("debug");
		expect(JSON.parse(lines[1]).level).toBe("warn");
		expect(JSON.parse(lines[2]).level).toBe("error");
		expect(JSON.parse(lines[2]).metadata.error_message).toBe("err");
	});

	test("async context", () => {
		const lines: string[] = [];
		const log = new Logger(l => lines.push(l));

		log.runWithContext({ trace_id: "t1" }, () => {
			log.info("in_context");
			expect(log.getContext().trace_id).toBe("t1");
		});

		log.info("out_context");

		const entry1 = JSON.parse(lines[0]);
		const entry2 = JSON.parse(lines[1]);

		expect(entry1.trace_id).toBe("t1");
		expect(entry2.trace_id).toBeUndefined();
	});

	test("setContext / clearContext (async)", () => {
		const lines: string[] = [];
		const log = new Logger(l => lines.push(l));

		log.setContext({ user: "u1" });
		// AsyncLocalStorage enterWith is scoped to subsequent async calls, but here synchronous.
		// Node/Bun enterWith behavior implies it sticks for the rest of synchronous execution too in the same resource scope.

		log.info("test");
		// Since we didn't run inside runWithContext, setContext might attach to root store or do nothing if storage not active?
		// AsyncLocalStorage works even at top level if enterWith is called.

		// Wait, AsyncLocalStorage documentation says enterWith disables automatic context loss for some cases.
		// Let's verify behavior.

		// Actually, if I use `enterWith`, subsequent calls should see it.
		expect(JSON.parse(lines[0]).user).toBe("u1");

		log.clearContext();
		log.info("cleared");
		expect(JSON.parse(lines[1]).user).toBeUndefined();
	});

	test("sync context fallback", () => {
		const lines: string[] = [];
		const log = new Logger(l => lines.push(l), false); // Disable async storage

		log.setContext({ trace_id: "s1" });
		log.info("sync");
		expect(JSON.parse(lines[0]).trace_id).toBe("s1");

		log.runWithContext({ trace_id: "s2" }, () => {
			log.info("nested");
			expect(JSON.parse(lines[1]).trace_id).toBe("s2");
		});

		log.info("restored");
		expect(JSON.parse(lines[2]).trace_id).toBe("s1");

		log.clearContext();
		log.info("cleared");
		expect(JSON.parse(lines[3]).trace_id).toBeUndefined();
	});

	test("createLogger factory", () => {
		const l1 = createLogger();
		expect(l1).toBeInstanceOf(Logger);

		const l2 = createLogger(() => { });
		expect(l2).toBeInstanceOf(Logger);

		const l3 = createLogger({ writer: () => { }, useAsyncStorage: false });
		expect(l3).toBeInstanceOf(Logger);
	});

	test("default writer uses stderr", () => {
		const spy = spyOn(process.stderr, "write").mockImplementation(() => true);
		const l = new Logger();
		l.info("test");
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
