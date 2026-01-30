import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { extractLinks, validateAllLinks, validateLink } from "../src/validator";

describe("Link Validator Logic", () => {
	describe("extractLinks", () => {
		it("should extract simple markdown links", () => {
			const md =
				"[Google](https://google.com) and [GitHub](https://github.com)";
			const links = extractLinks(md);
			expect(links).toContain("https://google.com");
			expect(links).toContain("https://github.com");
		});

		it("should extract links within lists and text spans", () => {
			const md = `
- Item with [Link 1](https://link1.com)
- Another [Link 2](https://link2.com)
  - Nested [Link 3](https://link3.com)
            `;
			const links = extractLinks(md);
			expect(links).toHaveLength(3);
			expect(links).toContain("https://link1.com");
			expect(links).toContain("https://link3.com");
		});

		it("should ignore duplicate links", () => {
			const md = "[Link](https://test.com) and [Same](https://test.com)";
			const links = extractLinks(md);
			expect(links).toHaveLength(1);
		});
	});

	describe("validateLink", () => {
		let fetchSpy: ReturnType<typeof spyOn>;

		beforeEach(() => {
			fetchSpy = spyOn(globalThis, "fetch");
		});

		afterEach(() => {
			fetchSpy.mockRestore();
			mock.clearAllMocks();
		});

		it("should return ok for a successful HEAD request", async () => {
			fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);
			const result = await validateLink("https://ok.com");
			expect(result.ok).toBe(true);
			expect(result.status).toBe(200);
			expect(fetch).toHaveBeenCalledWith(
				"https://ok.com",
				expect.objectContaining({ method: "HEAD" }),
			);
		});

		it("should fallback to GET if HEAD returns 405", async () => {
			fetchSpy
				.mockResolvedValueOnce({ ok: false, status: 405 } as Response)
				.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

			const result = await validateLink("https://no-head.com");
			expect(result.ok).toBe(true);
			expect(result.status).toBe(200);
			expect(fetch).toHaveBeenCalledTimes(2);
		});

		it("should return not ok for 404", async () => {
			fetchSpy.mockResolvedValue({
				ok: false,
				status: 404,
			} as Response);
			const result = await validateLink("https://broken.com");
			expect(result.ok).toBe(false);
			expect(result.status).toBe(404);
		});

		it("should handle timeouts", async () => {
			fetchSpy.mockRejectedValue({ name: "AbortError" });
			const result = await validateLink("https://slow.com", 10);
			expect(result.ok).toBe(false);
			expect(result.error).toBe("Timeout");
		});

		it("should skip mailto and other non-http links", async () => {
			const result = await validateLink("mailto:test@example.com");
			expect(result.ok).toBe(true);
			expect(fetch).not.toHaveBeenCalled();
		});
	});

	describe("validateAllLinks", () => {
		it("should validate multiple links in parallel", async () => {
			const localFetchSpy = spyOn(globalThis, "fetch");
			localFetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);
			const urls = ["https://a.com", "https://b.com", "https://c.com"];
			const results = await validateAllLinks(urls, 2);
			expect(results).toHaveLength(3);
			expect(results.every((r) => r.ok)).toBe(true);
			localFetchSpy.mockRestore();
		});
	});
});
