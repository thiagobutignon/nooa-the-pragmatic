import { describe, expect, it } from "bun:test";
import {
	asyncResult,
	errorResult,
	silentResult,
	toolResult,
	userResult,
} from "./types";

describe("ToolResult", () => {
	it("creates basic result with forLlm only", () => {
		const r = toolResult("File read: 42 lines");
		expect(r.forLlm).toBe("File read: 42 lines");
		expect(r.forUser).toBeUndefined();
		expect(r.silent).toBe(false);
		expect(r.async).toBe(false);
		expect(r.isError).toBe(false);
	});

	it("creates silent result", () => {
		const r = silentResult("Config saved");
		expect(r.forLlm).toBe("Config saved");
		expect(r.silent).toBe(true);
	});

	it("creates error result", () => {
		const r = errorResult("File not found", new Error("ENOENT"));
		expect(r.isError).toBe(true);
		expect(r.error?.message).toBe("ENOENT");
	});

	it("creates async result", () => {
		const r = asyncResult("Subagent spawned");
		expect(r.async).toBe(true);
	});

	it("creates user-facing result", () => {
		const r = userResult("Found 42 files matching query");
		expect(r.forLlm).toBe("Found 42 files matching query");
		expect(r.forUser).toBe("Found 42 files matching query");
		expect(r.silent).toBe(false);
	});
});
