import { describe, expect, it } from "bun:test";
import { createLogger } from "./logger";

describe("Logger", () => {
	it("writes structured JSON with context", () => {
		const writes: string[] = [];
		const logger = createLogger({
			writer: (line) => {
				writes.push(String(line));
			},
			useAsyncStorage: false,
		});

		logger.setContext({ trace_id: "t-123", command: "read" });
		logger.info("read.success", { bytes: 10 });

		expect(writes.length).toBeGreaterThan(0);
		const payload = JSON.parse(String(writes[0] ?? ""));
		expect(payload.level).toBe("info");
		expect(payload.event).toBe("read.success");
		expect(payload.trace_id).toBe("t-123");
		expect(payload.metadata.bytes).toBe(10);
	});
});
