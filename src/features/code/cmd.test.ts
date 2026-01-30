import { describe, expect, test } from "bun:test";
import cmd from "./cli";

describe("Code Command Definition", () => {
	test("exports valid command", () => {
		expect(cmd.name).toBe("code");
		expect(cmd.description).toContain("Code operations");
		expect(typeof cmd.execute).toBe("function");
	});
});
