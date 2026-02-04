import { describe, expect, test } from "bun:test";
import cmd, { codeAgentDoc, codeMeta } from "./cli";

describe("Code Command Definition", () => {
	test("exports valid command", () => {
		expect(cmd.name).toBe("code");
		expect(cmd.description).toContain("Code operations");
		expect(typeof cmd.execute).toBe("function");
	});

	test("exposes meta and agent doc", () => {
		expect(codeMeta.name).toBe("code");
		expect(codeMeta.changelog[0]?.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(codeAgentDoc).toContain("<instruction");
	});
});
