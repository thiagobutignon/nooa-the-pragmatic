import { describe, expect, test } from "bun:test";
import { parseMouseScroll } from "./mouse";

describe("parseMouseScroll", () => {
	test("detects wheel up", () => {
		const result = parseMouseScroll("\u001b[<64;10;5M");
		expect(result).toBe("up");
	});

	test("detects wheel down", () => {
		const result = parseMouseScroll("\u001b[<65;10;5M");
		expect(result).toBe("down");
	});

	test("returns null for non-scroll", () => {
		const result = parseMouseScroll("\u001b[<0;10;5M");
		expect(result).toBe(null);
	});
});
