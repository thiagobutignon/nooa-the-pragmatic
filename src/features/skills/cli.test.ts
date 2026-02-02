import { describe, expect, test } from "bun:test";
import skillsCommand from "./cli";

describe("Skills CLI", () => {
    test("has correct structure", () => {
        expect(skillsCommand.name).toBe("skills");
        expect(skillsCommand.description).toBeDefined();
        expect(typeof skillsCommand.execute).toBe("function");
    });
});
