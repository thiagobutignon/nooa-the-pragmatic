import { describe, expect, test } from "bun:test";
import { pwdAgentDoc, pwdMeta, run } from "./cli";

describe("pwd feature", () => {
	test("run returns current working directory", async () => {
		const result = await run({});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.cwd).toBe(process.cwd());
		}
	});

	test("pwdMeta exposes name and version", () => {
		expect(pwdMeta.name).toBe("pwd");
		expect(pwdMeta.changelog[0]?.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("pwdAgentDoc embeds instruction and version", () => {
		expect(pwdAgentDoc).toContain("<instruction");
		expect(pwdAgentDoc).toContain(`version="${pwdMeta.changelog[0]?.version}"`);
	});
});
