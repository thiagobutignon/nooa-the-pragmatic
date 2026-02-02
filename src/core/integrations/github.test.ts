import { describe, expect, test } from "bun:test";
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

	test("has mergePR method", () => {
		const client = new GitHubClient("test-token");
		expect(typeof client.mergePR).toBe("function");
	});

	test("has closePR method", () => {
		const client = new GitHubClient("test-token");
		expect(typeof client.closePR).toBe("function");
	});

	test("has commentPR method", () => {
		const client = new GitHubClient("test-token");
		expect(typeof client.commentPR).toBe("function");
	});

	test("has getPRStatus method", () => {
		const client = new GitHubClient("test-token");
		expect(typeof client.getPRStatus).toBe("function");
	});
});
