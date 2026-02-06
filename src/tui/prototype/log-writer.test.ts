import { describe, expect, test } from "bun:test";
import { formatLogLine } from "./log-writer";

describe("formatLogLine", () => {
	test("serializes event to json", () => {
		const line = formatLogLine({ type: "status", message: "ok" });
		const parsed = JSON.parse(line);
		expect(parsed.type).toBe("status");
		expect(parsed.message).toBe("ok");
		expect(typeof parsed.timestamp).toBe("string");
	});
});
