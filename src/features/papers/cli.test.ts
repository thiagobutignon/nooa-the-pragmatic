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

const noSleep = async (_ms: number) => {};

describe("papers.run()", () => {
	afterEach(() => {
		mock.restore();
	});

	// ── Happy path ──────────────────────────────────────────────────────────

	test("returns papers on successful fetch", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		const result = await run({ limit: 5, category: "cs.AI", _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(2);
		expect(result.data.source).toBe("arxiv");
		expect(result.data.papers[0]?.title).toContain("Large Language Models");
		expect(result.data.papers[0]?.authors).toContain("Alice Smith");
		expect(result.data.papers[0]?.url).toBe("https://arxiv.org/abs/2502.00001");
	});

	test("defaults to limit 5 and category cs.AI", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep });

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("cs.AI");
		expect(calledUrl).toContain("max_results=5");
	});

	test("respects custom limit and category", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ limit: "3", category: "cs.LG", _sleep: noSleep });

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("cs.LG");
		expect(calledUrl).toContain("max_results=3");
	});

	test("includes start offset in URL when --start is set", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ limit: 5, start: "10", _sleep: noSleep });

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("start=10");
	});

	test("defaults to start=0", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep });

		const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
		expect(calledUrl).toContain("start=0");
	});

	// ── Validation ───────────────────────────────────────────────────────────

	test("returns papers.invalid_limit for limit 0", async () => {
		const result = await run({ limit: "0", _sleep: noSleep });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	test("returns papers.invalid_limit for limit 21", async () => {
		const result = await run({ limit: "21", _sleep: noSleep });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	test("returns papers.invalid_limit for non-numeric limit", async () => {
		const result = await run({ limit: "abc", _sleep: noSleep });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.invalid_limit");
	});

	// ── Network resilience (retry) ────────────────────────────────────────────

	test("retries on 503 and succeeds on second attempt", async () => {
		let calls = 0;
		spyOn(globalThis, "fetch").mockImplementation(async () => {
			calls++;
			if (calls === 1) return new Response("", { status: 503 });
			return new Response(MOCK_ARXIV_XML, { status: 200 });
		});

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
	});

	test("fails with papers.fetch_failed after exhausting retries", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("", { status: 503 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	test("retries on network error and succeeds on second attempt", async () => {
		let calls = 0;
		spyOn(globalThis, "fetch").mockImplementation(async () => {
			calls++;
			if (calls === 1) throw new Error("ECONNREFUSED");
			return new Response(MOCK_ARXIV_XML, { status: 200 });
		});

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
	});

	test("returns papers.fetch_failed after all retries exhausted on network error", async () => {
		spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	// ── User-Agent ────────────────────────────────────────────────────────────

	test("sends nooa User-Agent header to arXiv", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep });

		const calledOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit;
		const headers = calledOptions?.headers as Record<string, string>;
		expect(headers?.["User-Agent"]).toMatch(/^nooa\//);
	});

	// ── URL normalization ─────────────────────────────────────────────────────

	test("normalizes http arxiv URLs to https", async () => {
		const xmlWithHttp = MOCK_ARXIV_XML.replace(
			"https://arxiv.org/abs/2502.00001",
			"http://arxiv.org/abs/2502.00001",
		);
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(xmlWithHttp, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.url).toMatch(/^https:/);
	});

	test("strips version suffix from arxiv URL", async () => {
		const xmlWithVersion = MOCK_ARXIV_XML.replace(
			"https://arxiv.org/abs/2502.00001",
			"https://arxiv.org/abs/2502.00001v3",
		);
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(xmlWithVersion, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.url).toBe("https://arxiv.org/abs/2502.00001");
	});

	// ── XML entity decoding ───────────────────────────────────────────────────

	test("decodes XML entities in title and abstract", async () => {
		const xmlWithEntities = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://arxiv.org/abs/2502.00010</id>
    <title>LLMs &amp; Agents: A &lt;New&gt; Paradigm</title>
    <summary>We show that x &lt; y and a &amp; b together yield &quot;improvements&quot;.</summary>
    <published>2026-02-24T12:00:00Z</published>
    <author><name>Dana Lee</name></author>
  </entry>
</feed>`;
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(xmlWithEntities, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.title).toBe(
			"LLMs & Agents: A <New> Paradigm",
		);
		expect(result.data.papers[0]?.abstract).toContain("x < y");
		expect(result.data.papers[0]?.abstract).toContain('"improvements"');
	});

	// ── Whitespace normalization ──────────────────────────────────────────────

	test("collapses excessive whitespace in title and abstract", async () => {
		const xmlWithWhitespace = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>https://arxiv.org/abs/2502.00020</id>
    <title>Multi-Line
    Title With   Extra Spaces</title>
    <summary>First sentence.
    Second sentence with   lots   of   spaces.</summary>
    <published>2026-02-24T12:00:00Z</published>
    <author><name>Eve Grant</name></author>
  </entry>
</feed>`;
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(xmlWithWhitespace, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.title).toBe(
			"Multi-Line Title With Extra Spaces",
		);
		expect(result.data.papers[0]?.abstract).not.toMatch(/\s{2,}/);
	});

	// ── --no-abstract ─────────────────────────────────────────────────────────

	test("returns empty string for abstract when noAbstract is true", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		const result = await run({ noAbstract: true, _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.abstract).toBe("");
	});

	// ── Edge cases ────────────────────────────────────────────────────────────

	test("returns empty papers array for empty feed", async () => {
		const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(emptyXml, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(0);
		expect(result.data.papers).toHaveLength(0);
	});

	test("skips entries missing both title and url", async () => {
		const xmlMissingFields = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <summary>No title no id</summary>
  </entry>
  <entry>
    <id>https://arxiv.org/abs/2502.00099</id>
    <title>Valid Paper</title>
    <summary>Valid abstract.</summary>
    <published>2026-02-24T12:00:00Z</published>
    <author><name>Frank Brown</name></author>
  </entry>
</feed>`;
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(xmlMissingFields, { status: 200 }),
		);

		const result = await run({ _sleep: noSleep });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(1);
		expect(result.data.papers[0]?.title).toBe("Valid Paper");
	});
});
