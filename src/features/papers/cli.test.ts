import { describe, expect, mock, test } from "bun:test";
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

function createFetchMock(response: Response | Promise<Response>) {
	return mock(() => Promise.resolve(response));
}

function getArxivCalls(fetchMock: ReturnType<typeof mock>) {
	return fetchMock.mock.calls.filter((call) =>
		String(call[0]).startsWith("https://export.arxiv.org/api/query?"),
	);
}

describe("papers.run()", () => {
	test("returns papers on successful fetch", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		const result = await run({
			limit: 5,
			category: "cs.AI",
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(2);
		expect(result.data.source).toBe("arxiv");
		expect(result.data.papers[0]?.title).toContain("Large Language Models");
		expect(result.data.papers[0]?.authors).toContain("Alice Smith");
		expect(result.data.papers[0]?.url).toBe("https://arxiv.org/abs/2502.00001");
	});

	test("defaults to limit 5 and category cs.AI", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep, _fetch: fetchMock as typeof fetch });

		const arxivCalls = getArxivCalls(fetchMock);
		expect(arxivCalls).toHaveLength(1);
		const calledUrl = String(arxivCalls[0]?.[0]);
		expect(calledUrl).toContain("cs.AI");
		expect(calledUrl).toContain("max_results=5");
	});

	test("respects custom limit and category", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({
			limit: "3",
			category: "cs.LG",
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		const calledUrl = String(getArxivCalls(fetchMock)[0]?.[0]);
		expect(calledUrl).toContain("cs.LG");
		expect(calledUrl).toContain("max_results=3");
	});

	test("includes start offset in URL when --start is set", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({
			limit: 5,
			start: "10",
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		const calledUrl = String(getArxivCalls(fetchMock)[0]?.[0]);
		expect(calledUrl).toContain("start=10");
	});

	test("defaults to start=0", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep, _fetch: fetchMock as typeof fetch });

		const calledUrl = String(getArxivCalls(fetchMock)[0]?.[0]);
		expect(calledUrl).toContain("start=0");
	});

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

	test("retries on 503 and succeeds on second attempt", async () => {
		let calls = 0;
		const fetchMock = mock(async () => {
			calls++;
			if (calls === 1) return new Response("", { status: 503 });
			return new Response(MOCK_ARXIV_XML, { status: 200 });
		});

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
	});

	test("fails with papers.fetch_failed after exhausting retries", async () => {
		const fetchMock = createFetchMock(new Response("", { status: 503 }));

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	test("retries on network error and succeeds on second attempt", async () => {
		let calls = 0;
		const fetchMock = mock(async () => {
			calls++;
			if (calls === 1) throw new Error("ECONNREFUSED");
			return new Response(MOCK_ARXIV_XML, { status: 200 });
		});

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		expect(calls).toBe(2);
	});

	test("returns papers.fetch_failed after all retries exhausted on network error", async () => {
		const fetchMock = mock(() => Promise.reject(new Error("ECONNREFUSED")));

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("papers.fetch_failed");
	});

	test("sends nooa User-Agent header to arXiv", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		await run({ _sleep: noSleep, _fetch: fetchMock as typeof fetch });

		const calledOptions = getArxivCalls(fetchMock)[0]?.[1] as RequestInit;
		const headers = calledOptions?.headers as Record<string, string>;
		expect(headers?.["User-Agent"]).toMatch(/^nooa\//);
	});

	test("normalizes http arxiv URLs to https", async () => {
		const xmlWithHttp = MOCK_ARXIV_XML.replace(
			"https://arxiv.org/abs/2502.00001",
			"http://arxiv.org/abs/2502.00001",
		);
		const fetchMock = createFetchMock(
			new Response(xmlWithHttp, { status: 200 }),
		);

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.url).toMatch(/^https:/);
	});

	test("strips version suffix from arxiv URL", async () => {
		const xmlWithVersion = MOCK_ARXIV_XML.replace(
			"https://arxiv.org/abs/2502.00001",
			"https://arxiv.org/abs/2502.00001v3",
		);
		const fetchMock = createFetchMock(
			new Response(xmlWithVersion, { status: 200 }),
		);

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.url).toBe("https://arxiv.org/abs/2502.00001");
	});

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
		const fetchMock = createFetchMock(
			new Response(xmlWithEntities, { status: 200 }),
		);

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.title).toBe(
			"LLMs & Agents: A <New> Paradigm",
		);
		expect(result.data.papers[0]?.abstract).toContain("x < y");
		expect(result.data.papers[0]?.abstract).toContain('"improvements"');
	});

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
		const fetchMock = createFetchMock(
			new Response(xmlWithWhitespace, { status: 200 }),
		);

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.title).toBe(
			"Multi-Line Title With Extra Spaces",
		);
		expect(result.data.papers[0]?.abstract).not.toMatch(/\s{2,}/);
	});

	test("returns empty string for abstract when noAbstract is true", async () => {
		const fetchMock = createFetchMock(
			new Response(MOCK_ARXIV_XML, { status: 200 }),
		);

		const result = await run({
			noAbstract: true,
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.papers[0]?.abstract).toBe("");
	});

	test("returns empty papers array for empty feed", async () => {
		const emptyXml = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`;
		const fetchMock = createFetchMock(new Response(emptyXml, { status: 200 }));

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

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
		const fetchMock = createFetchMock(
			new Response(xmlMissingFields, { status: 200 }),
		);

		const result = await run({
			_sleep: noSleep,
			_fetch: fetchMock as typeof fetch,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.count).toBe(1);
		expect(result.data.papers[0]?.title).toBe("Valid Paper");
	});
});
