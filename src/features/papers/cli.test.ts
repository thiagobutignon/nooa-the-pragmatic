import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { run } from "./cli";

const MOCK_ARXIV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://arxiv.org/abs/2502.00001</id>
    <title>Advances in Large Language Models for Code Generation</title>
    <summary>This paper presents a comprehensive survey of large language models applied to automated code generation tasks.</summary>
    <published>2026-02-24T12:00:00Z</published>
    <author><name>Alice Smith</name></author>
    <author><name>Bob Jones</name></author>
  </entry>
  <entry>
    <id>https://arxiv.org/abs/2502.00002</id>
    <title>Efficient Attention Mechanisms in Transformers</title>
    <summary>We propose a novel attention mechanism that reduces quadratic complexity to linear for long sequences.</summary>
    <published>2026-02-23T10:00:00Z</published>
    <author><name>Carol White</name></author>
  </entry>
</feed>`;

describe("papers.run()", () => {
	afterEach(() => {
		mock.restore();
	});

	test("returns papers on successful fetch", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		const result = await run({ limit: 5, topic: "cs.AI" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.count).toBe(2);
		expect(result.data.source).toBe("arxiv");
		expect(result.data.papers[0]?.title).toContain("Large Language Models");
		expect(result.data.papers[0]?.authors).toContain("Alice Smith");
		expect(result.data.papers[0]?.url).toBe("https://arxiv.org/abs/2502.00001");
	});

	test("defaults to limit 5 and topic cs.AI", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("cs.AI");
		expect(calledUrl).toContain("max_results=5");
	});

	test("respects custom limit and topic", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ limit: "3", topic: "cs.LG" });

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("cs.LG");
		expect(calledUrl).toContain("max_results=3");
	});

	test("returns papers.invalid_limit for limit 0", async () => {
		const result = await run({ limit: "0" });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	test("returns papers.invalid_limit for limit 21", async () => {
		const result = await run({ limit: "21" });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	test("returns papers.invalid_limit for non-numeric limit", async () => {
		const result = await run({ limit: "abc" });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	test("returns papers.fetch_failed when arXiv returns HTTP error", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("Service Unavailable", { status: 503 }),
		);

		const result = await run({ limit: 5 });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	test("returns papers.fetch_failed on network error", async () => {
		spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

		const result = await run({ limit: 5 });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	test("returns empty papers array for empty feed", async () => {
		const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(emptyXml, { status: 200 }),
		);

		const result = await run({ limit: 5 });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(0);
		expect(result.data.papers).toHaveLength(0);
	});
});
