import { describe, expect, it } from "bun:test";
import { DeterministicScorer } from "./deterministic";

describe("DeterministicScorer", () => {
	const scorer = new DeterministicScorer();

	it("passes valid JSON check", () => {
		const output = '{"ok": true}';
		const res = scorer.score(output, [{ type: "is_valid_json" }]);
		expect(res.passed).toBe(1);
	});

	it("extracts JSON from markdown", () => {
		const output = 'Here is the result:\n```json\n{"ok": true}\n```';
		const res = scorer.score(output, [{ type: "is_valid_json" }]);
		expect(res.passed).toBe(1);
	});

	it("handles invalid JSON", () => {
		const output = "not json";
		const res = scorer.score(output, [{ type: "is_valid_json" }]);
		expect(res.passed).toBe(0);
		expect(res.results[0].message).toContain("Invalid JSON");
	});

	it("skips checks if no valid JSON parsed", () => {
		const output = "not json";
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "has_property", property: "test" },
		]);
		expect(res.passed).toBe(0);
		expect(res.results[1].message).toContain("No valid JSON to check");
	});

	it("verifies properties", () => {
		const output = '{"findings": []}';
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "has_property", property: "findings" },
		]);
		expect(res.passed).toBe(2);
	});

	it("checks enums on arrays", () => {
		const output = JSON.stringify({
			findings: [{ category: "bug" }, { category: "style" }],
		});
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{
				type: "enum_check",
				property: "findings[].category",
				allowed: ["bug", "style"],
			},
		]);
		expect(res.passed).toBe(2);
	});

	it("fails on invalid enum value", () => {
		const output = JSON.stringify({
			findings: [{ category: "maintainability" }],
		});
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{
				type: "enum_check",
				property: "findings[].category",
				allowed: ["bug", "style"],
			},
		]);
		expect(res.passed).toBe(1); // Only JSON passed
	});

	it("detects absolute paths", () => {
		const output = JSON.stringify({
			findings: [{ file: "/abs/path" }],
		});
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "no_absolute_paths", property: "findings[].file" },
		]);
		expect(res.passed).toBe(1); // Only JSON passed
	});

	it("verifies max_count", () => {
		const output = JSON.stringify({
			items: [1, 2, 3],
		});
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "max_count", property: "items", limit: 2 },
		]);
		expect(res.passed).toBe(1); // JSON passes, count fails (3 > 2)
		expect(res.results[1].passed).toBe(false);
	});

	it("verifies max_count success", () => {
		const output = JSON.stringify({ items: [1] });
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "max_count", property: "items", limit: 2 },
		]);
		expect(res.passed).toBe(2);
	});

	it("verifies property_equals", () => {
		const output = JSON.stringify({ status: "done" });
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "property_equals", property: "status", value: "done" },
		]);
		expect(res.passed).toBe(2);
	});

	it("handles missing property or limit for max_count", () => {
		const output = "{}";
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "max_count", property: "items" }, // Missing limit
		]);
		expect(res.results[1].passed).toBe(false);
		expect(res.results[1].message).toContain("Missing property or limit");
	});

	it("handles missing property for property_equals", () => {
		const output = "{}";
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "property_equals", value: "test" }, // Missing property
		]);
		expect(res.results[1].passed).toBe(false);
		expect(res.results[1].message).toContain("Missing property");
	});

	it("handles edge cases in getValues", () => {
		const output = JSON.stringify({
			tags: ["a", null, { val: 1 }],
			meta: { author: "me" },
			invalid: "not-an-array",
		});
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{ type: "enum_check", property: "", allowed: ["[object Object]"] }, // Path is empty
			{ type: "enum_check", property: "not_found", allowed: ["undefined"] }, // Key not found
			{ type: "enum_check", property: "not_found[].val", allowed: [] }, // Array not found
			{
				type: "enum_check",
				property: "tags[].val",
				allowed: ["1", "undefined"],
			}, // Non-object in array
			{ type: "enum_check", property: "invalid[].val", allowed: [] }, // Property is not an array
		]);
		expect(res.results[1].passed).toBe(true); // Empty path
		expect(res.results[5].passed).toBe(true); // Invalid array (returns [] which means 0 invalid)
	});

	it("handles general errors during check", () => {
		const output = '{"ok": true}';
		const res = scorer.score(output, [
			{ type: "is_valid_json" },
			{
				type: "enum_check",
				property: {
					includes: () => {
						throw new Error("Path error");
					},
				},
			} as any,
		]);
		expect(res.results[1].passed).toBe(false);
		expect(res.results[1].message).toContain(
			"Error in check enum_check: Path error",
		);
	});
});
