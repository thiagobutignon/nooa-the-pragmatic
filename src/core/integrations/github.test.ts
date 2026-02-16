import { describe, expect, mock, test } from "bun:test";
import { GitHubClient } from "./github";

describe("GitHubClient", () => {
	const token = "test-token";
	const client = new GitHubClient(token);
	const owner = "owner";
	const repo = "repo";

	test("requestJson handles success", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ ok: true }), { status: 200 }),
			),
		);
		const result = (await client.listPRs(owner, repo)) as unknown;
		expect(result.ok).toBe(true);
	});

	test("requestJson handles API error with message", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
			),
		);
		await expect(client.listPRs(owner, repo)).rejects.toThrow(
			"GitHub API Error: Not Found",
		);
	});

	test("requestJson handles API error without valid json", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(
				new Response("Internal Server Error", {
					status: 500,
					statusText: "Internal Server Error",
				}),
			),
		);
		await expect(client.listPRs(owner, repo)).rejects.toThrow(
			"GitHub API Error: Internal Server Error",
		);
	});

	test("createPR sends correct body", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.title).toBe("Title");
			return Promise.resolve(
				new Response(JSON.stringify({ id: 1 }), { status: 201 }),
			);
		});
		await client.createPR(owner, repo, "head", "base", "Title", "Body");
	});

	test("getPRDiff returns text", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(new Response("diff content", { status: 200 })),
		);
		const diff = await client.getPRDiff(owner, repo, 1);
		expect(diff).toBe("diff content");
	});

	test("getPRDiff throws on failure", async () => {
		// @ts-expect-error
		global.fetch = mock(() =>
			Promise.resolve(
				new Response("", { status: 404, statusText: "Not Found" }),
			),
		);
		await expect(client.getPRDiff(owner, repo, 1)).rejects.toThrow(
			"GitHub API Error: Failed to fetch PR diff (Not Found)",
		);
	});

	test("mergePR uses correct method", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.merge_method).toBe("squash");
			return Promise.resolve(new Response(JSON.stringify({ merged: true })));
		});
		await client.mergePR(owner, repo, 1, { method: "squash" });
	});

	test("closePR sends closed state", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.state).toBe("closed");
			return Promise.resolve(new Response(JSON.stringify({ state: "closed" })));
		});
		await client.closePR(owner, repo, 1);
	});

	test("commentPR sends body", async () => {
		// @ts-expect-error
		global.fetch = mock((_url, init) => {
			const body = JSON.parse(init.body);
			expect(body.body).toBe("comment");
			return Promise.resolve(new Response(JSON.stringify({ id: 1 })));
		});
		await client.commentPR(owner, repo, 1, "comment");
	});

	test("getPRStatus aggregates info, approvals and checks", async () => {
		let _callCount = 0;
		// @ts-expect-error
		global.fetch = mock((url) => {
			_callCount++;
			if (url.includes("/reviews")) {
				return Promise.resolve(
					new Response(
						JSON.stringify([{ state: "APPROVED" }, { state: "COMMENT" }]),
					),
				);
			}
			if (url.includes("/check-runs")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							check_runs: [
								{ conclusion: "success" },
								{ conclusion: "failure" },
								{ conclusion: "neutral" },
								{ conclusion: "skipped" },
							],
						}),
					),
				);
			}
			// PR details
			return Promise.resolve(
				new Response(
					JSON.stringify({
						number: 1,
						title: "PR",
						state: "open",
						labels: [{ name: "bug" }],
						head: { sha: "abc" },
					}),
				),
			);
		});

		const status = await client.getPRStatus(owner, repo, 1);
		expect(status.number).toBe(1);
		expect(status.approvals).toBe(1);
		expect(status.labels).toContain("bug");
		expect(status.checks.passed).toBe(1);
		expect(status.checks.failed).toBe(1);
		expect(status.checks.total).toBe(4);
	});

	test("getPRStatus handles missing labels or sha", async () => {
		// @ts-expect-error
		global.fetch = mock((url) => {
			if (url.includes("/reviews")) return Promise.resolve(new Response("[]"));
			// PR details without head sha or labels
			return Promise.resolve(
				new Response(
					JSON.stringify({
						number: 2,
						title: "PR2",
						state: "open",
					}),
				),
			);
		});

		const status = await client.getPRStatus(owner, repo, 2);
		expect(status.labels).toEqual([]);
		expect(status.checks.total).toBe(0);
	});
});
