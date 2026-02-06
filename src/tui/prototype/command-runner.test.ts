import { describe, expect, test } from "bun:test";
import { buildNooaInvocation } from "./command-runner";

describe("buildNooaInvocation", () => {
	test("creates bun invocation with args", () => {
		const invocation = buildNooaInvocation("read README.md", {
			cwd: "/tmp/repo",
		});
		expect(invocation.cmd).toBe(process.execPath);
		expect(invocation.args[0]).toBe("index.ts");
		expect(invocation.args.slice(1)).toEqual(["read", "README.md"]);
		expect(invocation.cwd).toBe("/tmp/repo");
	});
});
