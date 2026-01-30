import { describe, expect, it } from "bun:test";
import { calculateMatchScore } from "../src/matcher";
import type { JsonResume } from "../src/json-resume";

describe("Matcher Engine", () => {
    const mockResume: JsonResume = {
        basics: { name: "Test User", label: "Dev", email: "a@b.com", phone: "", summary: "", location: { address: "", postalCode: "", city: "", countryCode: "", region: "" }, profiles: [] },
        skills: [
            { name: "Node.js", keywords: ["Typescript", "Bun"] }
        ],
        work: [
            { name: "Co", position: "Dev", startDate: "2020", highlights: ["Built React apps"], keywords: ["React"] }
        ]
    };

    it("should calculate high score for perfect match", () => {
        const jobDesc = "We need a Senior Node.js and Typescript expert who loves Bun and React.";
        const result = calculateMatchScore(mockResume, jobDesc);

        expect(result.score).toBeGreaterThanOrEqual(0.8);
        expect(result.matchingSkills).toContain("node.js");
        expect(result.matchingSkills).toContain("typescript");
        expect(result.matchingSkills).toContain("react");
    });

    it("should calculate lower score for partial match", () => {
        const jobDesc = "Python and Go developer wanted.";
        const result = calculateMatchScore(mockResume, jobDesc);

        expect(result.score).toBe(0);
        expect(result.matchingSkills).toHaveLength(0);
    });

    it("should handle mixed case matching", () => {
        const jobDesc = "NODE.JS developer";
        const result = calculateMatchScore(mockResume, jobDesc);
        expect(result.matchingSkills).toContain("node.js");
    });
});
