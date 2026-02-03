import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as execaModule from "execa";
import {
	ghClosePr,
	ghCommentPr,
	ghMergePr,
	ghPrCreate,
	ghPrDiff,
	ghPrList,
	ghStatusPr,
} from "./gh";

describe("GitHub Automation (gh.ts)", () => {
	afterEach(() => {
		// Just in case, though spies are usually restored in tests
	});

	test("ghPrCreate success", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "https://example.com/pr/1",
			exitCode: 0,
		} as any);

		const res = await ghPrCreate({
			base: "b",
			head: "h",
			title: "t",
			body: "b",
		});
		expect(res.url).toBe("https://example.com/pr/1");
		expect(spy).toHaveBeenCalledWith(
			"gh",
			expect.arrayContaining(["pr", "create"]),
			expect.anything(),
		);
		spy.mockRestore();
	});

	test("ghPrCreate failure", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stderr: "error message",
			exitCode: 1,
		} as any);

		await expect(
			ghPrCreate({ base: "b", head: "h", title: "t", body: "b" }),
		).rejects.toThrow("error message");
		spy.mockRestore();
	});

	test("ghPrList", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: JSON.stringify([{ number: 1, title: "T" }]),
			exitCode: 0,
		} as any);

		const res = await ghPrList();
		expect(res).toHaveLength(1);
		expect(res[0].number).toBe(1);
		spy.mockRestore();
	});

	test("ghPrDiff", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "diff content",
			exitCode: 0,
		} as any);

		const res = await ghPrDiff(1);
		expect(res).toBe("diff content");
		spy.mockRestore();
	});

	test("ghMergePr (squash)", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: JSON.stringify({ merged: true }),
			exitCode: 0,
		} as any);

		const res = await ghMergePr({
			number: 1,
			method: "squash",
			title: "T",
			message: "B",
		});
		expect(res.merged).toBe(true);
		expect(spy).toHaveBeenCalledWith(
			"gh",
			expect.arrayContaining(["--squash", "--subject", "T", "--body", "B"]),
			expect.anything(),
		);
		spy.mockRestore();
	});

	test("ghMergePr (rebase)", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "{}",
			exitCode: 0,
		} as any);
		await ghMergePr({ number: 1, method: "rebase" });
		expect(spy).toHaveBeenCalledWith(
			"gh",
			expect.arrayContaining(["--rebase"]),
			expect.anything(),
		);
		spy.mockRestore();
	});

	test("ghMergePr (merge)", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: "{}",
			exitCode: 0,
		} as any);
		await ghMergePr({ number: 1, method: "merge" });
		expect(spy).toHaveBeenCalledWith(
			"gh",
			expect.arrayContaining(["--merge"]),
			expect.anything(),
		);
		spy.mockRestore();
	});

	test("ghClosePr", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: JSON.stringify({ state: "CLOSED" }),
			exitCode: 0,
		} as any);

		const res = await ghClosePr(1);
		expect(res.state).toBe("CLOSED");
		spy.mockRestore();
	});

	test("ghCommentPr", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: JSON.stringify({ id: "123" }),
			exitCode: 0,
		} as any);

		const res = await ghCommentPr(1, "msg");
		expect(res.id).toBe("123");
		spy.mockRestore();
	});

	test("ghStatusPr", async () => {
		const spy = spyOn(execaModule, "execa").mockResolvedValue({
			stdout: JSON.stringify({ number: 1, state: "OPEN" }),
			exitCode: 0,
		} as any);

		const res = await ghStatusPr(1);
		expect(res.state).toBe("OPEN");
		spy.mockRestore();
	});
});
