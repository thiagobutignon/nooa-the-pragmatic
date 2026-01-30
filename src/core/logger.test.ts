import { describe, expect, it, spyOn } from "bun:test";
import { createLogger } from "./logger";

describe("Logger", () => {
	it("writes structured JSON with context", () => {
		const logger = createLogger();
		const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
			() => true,
		);

		logger.setContext({ trace_id: "t-123", command: "read" });
		logger.info("read.success", { bytes: 10 });

		expect(stderrSpy).toHaveBeenCalled();
		const payload = JSON.parse(String(stderrSpy.mock.calls[0]?.[0] ?? ""));
		expect(payload.level).toBe("info");
		expect(payload.event).toBe("read.success");
		expect(payload.trace_id).toBe("t-123");
		expect(payload.metadata.bytes).toBe(10);

		stderrSpy.mockRestore();
	});
});
