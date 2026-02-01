import { expect, test, describe } from "bun:test";
import { GitHubClient } from "./github";

describe("GitHubClient", () => {
    test("can instantiate with token", () => {
        const client = new GitHubClient("test-token");
        expect(client).toBeDefined();
    });

    test("has createPR method", () => {
        const client = new GitHubClient("test-token");
        expect(typeof client.createPR).toBe("function");
    });

    test("has listPRs method", () => {
        const client = new GitHubClient("test-token");
        expect(typeof client.listPRs).toBe("function");
    });
});
