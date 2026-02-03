import { describe, expect, it } from "bun:test";
import { sdk } from "./index";


describe("sdk.pr", () => {
	it("creates and lists via injected gh client", async () => {
		const gh = {
			ghPrCreate: async () => ({ url: "https://example.com/pr/1" }),
			ghPrList: async () => [{ number: 1, title: "Test", url: "https://example.com/pr/1" }],
			ghPrDiff: async () => "diff",
			ghMergePr: async () => ({ merged: true }),
			ghClosePr: async () => ({ state: "closed" }),
			ghCommentPr: async () => ({ id: 1 }),
			ghStatusPr: async () => ({ number: 1, title: "Test", state: "OPEN" }),
		};

		const createResult = await sdk.pr.create({
			title: "Test",
			body: "Body",
			head: "branch",
			base: "main",
			gh,
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) {
			throw new Error("Expected ok result");
		}
		expect(createResult.data.url).toContain("example.com");

		const listResult = await sdk.pr.list({ gh });
		expect(listResult.ok).toBe(true);
		if (!listResult.ok) {
			throw new Error("Expected ok result");
		}
		expect(listResult.data.length).toBe(1);
	});
});
