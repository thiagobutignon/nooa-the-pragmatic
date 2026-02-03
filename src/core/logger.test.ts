import { describe, expect, test } from "bun:test";
import { createLogger, createTraceId, Logger } from "./logger";

describe("Logger", () => {
	test("writes structured JSON with context", () => {
		const writes: string[] = [];
		const logger = createLogger({
			writer: (line) => {
				writes.push(String(line));
			},
			useAsyncStorage: false,
		});

		logger.setContext({ trace_id: "t-123", command: "read" });
		logger.info("read.success", { bytes: 10 }, "message");

		expect(writes.length).toBeGreaterThan(0);
		const payload = JSON.parse(String(writes[0] ?? ""));
		expect(payload.level).toBe("info");
		expect(payload.event).toBe("read.success");
		expect(payload.trace_id).toBe("t-123");
		expect(payload.message).toBe("message");
		expect(payload.metadata.bytes).toBe(10);
	});

	test("debug level", () => {
		const writes: string[] = [];
		const logger = createLogger((line) => writes.push(line));
		logger.debug("debug.event");
		expect(JSON.parse(writes[0]).level).toBe("debug");
	});

	test("warn level", () => {
		const writes: string[] = [];
		const logger = createLogger((line) => writes.push(line));
		logger.warn("warn.event");
		expect(JSON.parse(writes[0]).level).toBe("warn");
	});

	test("error level", () => {
		const writes: string[] = [];
		const logger = createLogger((line) => writes.push(line));
		logger.error("error.event", new Error("fail"), { id: 1 });
		const payload = JSON.parse(writes[0]);
		expect(payload.level).toBe("error");
		expect(payload.metadata.error_message).toBe("fail");
		expect(payload.metadata.id).toBe(1);
	});

	test("AsyncLocalStorage context", async () => {
		const writes: string[] = [];
		const logger = createLogger({
			writer: (line) => writes.push(line),
			useAsyncStorage: true,
		});

		await logger.runWithContext({ trace_id: "async-1" }, async () => {
			logger.info("async.event");
			expect(JSON.parse(writes[0]).trace_id).toBe("async-1");

			logger.setContext({ user: "alice" });
			logger.info("async.event2");
			expect(JSON.parse(writes[1]).user).toBe("alice");
		});

		expect(logger.getContext()).toEqual({});
	});

	test("getContext/clearContext without storage", () => {
		const logger = createLogger({ useAsyncStorage: false });
		logger.setContext({ a: 1 });
		expect(logger.getContext()).toEqual({ a: 1 });
		logger.clearContext();
		expect(logger.getContext()).toEqual({});
	});

	test("createTraceId handles crypto and fallback", () => {
		const id = createTraceId();
		expect(id).toBeDefined();
		expect(typeof id).toBe("string");
	});

	test("createLogger with functions and defaults", () => {
		const l1 = createLogger();
		expect(l1).toBeInstanceOf(Logger);

		const l2 = createLogger((_line) => {});
		expect(l2).toBeInstanceOf(Logger);
	});
});
