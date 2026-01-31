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
        const output = "Here is the result:\n```json\n{\"ok\": true}\n```";
        const res = scorer.score(output, [{ type: "is_valid_json" }]);
        expect(res.passed).toBe(1);
    });

    it("verifies properties", () => {
        const output = '{"findings": []}';
        const res = scorer.score(output, [
            { type: "is_valid_json" },
            { type: "has_property", property: "findings" }
        ]);
        expect(res.passed).toBe(2);
    });

    it("checks enums on arrays", () => {
        const output = JSON.stringify({
            findings: [
                { category: "bug" },
                { category: "style" }
            ]
        });
        const res = scorer.score(output, [
            { type: "is_valid_json" },
            { type: "enum_check", property: "findings[].category", allowed: ["bug", "style"] }
        ]);
        expect(res.passed).toBe(2);
    });

    it("fails on invalid enum value", () => {
        const output = JSON.stringify({
            findings: [{ category: "maintainability" }]
        });
        const res = scorer.score(output, [
            { type: "is_valid_json" },
            { type: "enum_check", property: "findings[].category", allowed: ["bug", "style"] }
        ]);
        expect(res.passed).toBe(1); // Only JSON passed
    });

    it("detects absolute paths", () => {
        const output = JSON.stringify({
            findings: [{ file: "/abs/path" }]
        });
        const res = scorer.score(output, [
            { type: "is_valid_json" },
            { type: "no_absolute_paths", property: "findings[].file" }
        ]);
        expect(res.passed).toBe(1); // Only JSON passed
    });
});
