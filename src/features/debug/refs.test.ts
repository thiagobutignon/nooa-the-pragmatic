import { describe, expect, test } from "bun:test";
import { assignBreakpointRefs, assignFrameRefs, assignValueRefs } from "./refs";

describe("debug refs", () => {
	test("assignFrameRefs creates stable @f refs", () => {
		const refs = assignFrameRefs([
			{ name: "(anonymous)", file: "app.js", line: 1 },
			{ name: "main", file: "app.js", line: 2 },
		]);

		expect(refs[0]?.ref).toBe("@f0");
		expect(refs[1]?.ref).toBe("@f1");
	});

	test("assignValueRefs creates stable @v refs", () => {
		const refs = assignValueRefs([
			{ name: "foo", value: "1", scope: "local" },
			{ name: "bar", value: "2", scope: "local" },
		]);

		expect(refs[0]?.ref).toBe("@v1");
		expect(refs[1]?.ref).toBe("@v2");
	});

	test("assignBreakpointRefs creates stable BP refs", () => {
		const refs = assignBreakpointRefs([
			{ file: "app.js", line: 10 },
			{ file: "app.js", line: 20 },
		]);

		expect(refs[0]?.ref).toBe("BP#1");
		expect(refs[1]?.ref).toBe("BP#2");
	});
});
