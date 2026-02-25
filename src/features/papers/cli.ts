import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { type AgentDocMeta, type SdkResult, sdkError } from "../../core/types";

export const papersMeta: AgentDocMeta = {
	name: "papers",
	description: "Fetch the latest AI research papers from arXiv",
	changelog: [
		{
			version: "1.1.0",
			changes: [
				"Renamed --topic to --category for clarity",
				"Added retry (2 attempts) with backoff on transient errors",
				"Added User-Agent header following arXiv best practices",
				"Added --no-abstract flag for lightweight piping",
				"Added --start flag for pagination",
				"XML entity decoding (&amp; &lt; &gt; &quot; &apos;)",
				"URL normalization to https + strip version suffix",
			],
		},
		{ version: "1.0.0", changes: ["Initial release"] },
	],
};

export const papersHelp = `
Usage: nooa papers [flags]

Fetch the latest AI research papers from arXiv.

Flags:
  --limit <n>        Number of papers to return (1-20, default: 5).
  --category <cat>   arXiv category (default: cs.AI). Examples: cs.LG, cs.CV, cs.CL.
  --start <n>        Result offset for pagination (default: 0).
  --no-abstract      Omit abstracts from output (faster for piping).
  --json             Output structured JSON.
  -h, --help         Show help message.

arXiv Category Reference:
  cs.AI   Artificial Intelligence (default)
  cs.LG   Machine Learning
  cs.CL   Computation & Language (NLP)
  cs.CV   Computer Vision
  cs.RO   Robotics
  stat.ML Statistics - Machine Learning

Examples:
  nooa papers
  nooa papers --limit 3 --json
  nooa papers --category cs.LG
  nooa papers --start 5 --limit 5   (page 2)
  nooa papers --no-abstract --json | nooa ai "which paper should I read first?"

Exit Codes:
  0: Success
  1: Runtime Error (fetch or parse failed)
  2: Validation Error (invalid limit)

Error Codes:
  papers.fetch_failed:  HTTP request to arXiv failed after retries
  papers.parse_failed:  arXiv XML response could not be parsed
  papers.invalid_limit: Limit is not a valid integer between 1 and 20
`;

export const papersSdkUsage = `
SDK Usage:
  const result = await papers.run({ limit: 5, category: "cs.AI" });
  if (result.ok) {
    for (const paper of result.data.papers) {
      console.log(paper.title, paper.url);
    }
  }
`;

export const papersUsage = {
	cli: "nooa papers [--limit <n>] [--category <cat>] [--start <n>] [--no-abstract] [--json]",
	sdk: 'await papers.run({ limit: 5, category: "cs.AI" })',
	tui: "PapersPanel()",
};

export const papersSchema = {
	limit: { type: "string", required: false },
	category: { type: "string", required: false },
	start: { type: "string", required: false },
	"no-abstract": { type: "boolean", required: false, default: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const papersOutputFields = [
	{ name: "papers", type: "array" },
	{ name: "count", type: "number" },
	{ name: "source", type: "string" },
];

export const papersErrors = [
	{
		code: "papers.fetch_failed",
		message: "HTTP request to arXiv failed after retries.",
	},
	{ code: "papers.parse_failed", message: "arXiv XML could not be parsed." },
	{
		code: "papers.invalid_limit",
		message: "Limit must be an integer between 1 and 20.",
	},
];

export const papersExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Fetch or parse error" },
	{ value: "2", description: "Validation error" },
];

export const papersExamples = [
	{
		input: "nooa papers",
		output: "Fetch the 5 latest cs.AI papers from arXiv.",
	},
	{
		input: "nooa papers --limit 3 --category cs.LG --json",
		output: "Fetch 3 latest Machine Learning papers as JSON.",
	},
	{
		input: "nooa papers --start 5 --limit 5",
		output: "Fetch papers 6–10 (page 2).",
	},
];

export interface Paper {
	title: string;
	authors: string[];
	abstract: string;
	url: string;
	published: string;
}

export interface PapersRunInput {
	limit?: string | number;
	category?: string;
	start?: string | number;
	noAbstract?: boolean;
	json?: boolean;
	/** @internal injected in tests to skip real delays */
	_sleep?: (ms: number) => Promise<void>;
}

export interface PapersRunResult {
	papers: Paper[];
	count: number;
	source: string;
}

const XML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&apos;": "'",
};

function decodeXmlEntities(text: string): string {
	// Named entities
	let result = text.replace(
		/&(?:amp|lt|gt|quot|apos);/g,
		(m) => XML_ENTITIES[m] ?? m,
	);
	// Numeric decimal entities &#123;
	result = result.replace(/&#(\d+);/g, (_, code) =>
		String.fromCharCode(Number(code)),
	);
	// Numeric hex entities &#x1F;
	result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
		String.fromCharCode(Number.parseInt(code, 16)),
	);
	return result;
}

function normalizeText(text: string): string {
	return decodeXmlEntities(text.replace(/\s+/g, " ").trim());
}

function normalizeArxivUrl(raw: string): string {
	// Ensure https
	let url = raw.trim().replace(/^http:\/\//, "https://");
	// Strip version suffix like v1, v2, v3
	url = url.replace(/v\d+$/, "");
	return url;
}

function parseArxivXml(xml: string): Paper[] {
	const papers: Paper[] = [];
	const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
	while ((match = entryRegex.exec(xml)) !== null) {
		const entry = match[1];
		if (!entry) continue;

		const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entry);
		const idMatch = /<id>([\s\S]*?)<\/id>/.exec(entry);
		const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(entry);
		const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(entry);

		const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)];
		const authors = authorMatches.map((m) => normalizeText(m[1] ?? ""));

		const title = titleMatch ? normalizeText(titleMatch[1] ?? "") : "";
		const rawUrl = idMatch ? (idMatch[1]?.trim() ?? "") : "";
		const url = rawUrl ? normalizeArxivUrl(rawUrl) : "";
		const abstract = summaryMatch ? normalizeText(summaryMatch[1] ?? "") : "";
		const published = publishedMatch ? (publishedMatch[1]?.trim() ?? "") : "";

		if (title && url) {
			papers.push({ title, authors, abstract, url, published });
		}
	}

	return papers;
}

const MAX_RETRIES = 2;
const RETRY_DELAYS = [300, 800];
const FETCH_TIMEOUT_MS = 10_000;
const NOOA_VERSION = "1.1.0";

async function fetchWithRetry(
	url: string,
	sleep: (ms: number) => Promise<void>,
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await sleep(RETRY_DELAYS[attempt - 1] ?? 300);
		}
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent": `nooa/${NOOA_VERSION} (https://github.com/thiagobutignon/nooa-the-pragmatic)`,
				},
			});
			clearTimeout(timeoutId);

			if (response.ok) return response;

			// Retry on transient server errors
			if (response.status >= 500 || response.status === 429) {
				lastError = new Error(`HTTP ${response.status}`);
				continue;
			}

			// Non-retryable HTTP error
			return response;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
		}
	}

	throw lastError ?? new Error("Unknown fetch error");
}

export async function run(
	input: PapersRunInput,
): Promise<SdkResult<PapersRunResult>> {
	const category = input.category ?? "cs.AI";
	const limitRaw = input.limit ?? 5;
	const limitNum =
		typeof limitRaw === "string" ? parseInt(limitRaw, 10) : limitRaw;
	const startRaw = input.start ?? 0;
	const startNum =
		typeof startRaw === "string" ? parseInt(startRaw, 10) : startRaw;
	const noAbstract = Boolean(input.noAbstract);
	const sleep = input._sleep ?? ((ms) => Bun.sleep(ms));

	if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 20) {
		return {
			ok: false,
			error: sdkError(
				"papers.invalid_limit",
				"Limit must be an integer between 1 and 20.",
				{ limit: String(limitRaw) },
			),
		};
	}

	const url = `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}&sortBy=submittedDate&sortOrder=descending&max_results=${limitNum}&start=${startNum}`;

	let responseText: string;
	try {
		const response = await fetchWithRetry(url, sleep);
		if (!response.ok) {
			return {
				ok: false,
				error: sdkError(
					"papers.fetch_failed",
					`arXiv returned HTTP ${response.status} after ${MAX_RETRIES} retries.`,
					{ status: response.status, url },
				),
			};
		}
		responseText = await response.text();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: sdkError(
				"papers.fetch_failed",
				"Failed to reach arXiv API after retries.",
				{ error: message, url },
			),
		};
	}

	let papers: Paper[];
	try {
		papers = parseArxivXml(responseText);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: sdkError(
				"papers.parse_failed",
				"Failed to parse arXiv response.",
				{ error: message },
			),
		};
	}

	if (noAbstract) {
		for (const paper of papers) {
			paper.abstract = "";
		}
	}

	return {
		ok: true,
		data: {
			papers,
			count: papers.length,
			source: "arxiv",
		},
	};
}

const papersBuilder = new CommandBuilder<PapersRunInput, PapersRunResult>()
	.meta(papersMeta)
	.usage(papersUsage)
	.schema(papersSchema)
	.help(papersHelp)
	.sdkUsage(papersSdkUsage)
	.outputFields(papersOutputFields)
	.examples(papersExamples)
	.errors(papersErrors)
	.exitCodes(papersExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			limit: { type: "string" },
			category: { type: "string" },
			start: { type: "string" },
			"no-abstract": { type: "boolean" },
		},
	})
	.parseInput(async ({ values }) => ({
		limit: values.limit as string | undefined,
		category: values.category as string | undefined,
		start: values.start as string | undefined,
		noAbstract: Boolean(values["no-abstract"]),
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}

		console.log(`\nLatest ${output.count} AI papers from arXiv:\n`);
		for (const [i, paper] of output.papers.entries()) {
			const num = String(i + 1).padStart(2, " ");
			console.log(`${num}. ${paper.title}`);
			if (paper.authors.length > 0) {
				const authorList = paper.authors.slice(0, 3).join(", ");
				const more =
					paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : "";
				console.log(`    Authors: ${authorList}${more}`);
			}
			console.log(`    Published: ${paper.published.slice(0, 10)}`);
			console.log(`    URL: ${paper.url}`);
			if (!values.noAbstract && paper.abstract) {
				const truncated =
					paper.abstract.length > 280
						? `${paper.abstract.slice(0, 280)}…`
						: paper.abstract;
				console.log(`    Abstract: ${truncated}`);
			}
			console.log();
		}
	})
	.onFailure((error, input) => {
		if (input.json) {
			console.error(
				JSON.stringify({
					ok: false,
					error: { code: error.code, message: error.message },
				}),
			);
			process.exitCode = error.code === "papers.invalid_limit" ? 2 : 1;
			return;
		}
		handleCommandError(error, ["papers.invalid_limit"]);
	})
	.telemetry({
		eventPrefix: "papers",
		successMetadata: (input, output) => ({
			count: output.count,
			category: input.category ?? "cs.AI",
			limit: input.limit ?? 5,
			start: input.start ?? 0,
		}),
		failureMetadata: (input, error) => ({
			error: error.message,
			category: input.category,
			limit: input.limit,
		}),
	});

export const papersAgentDoc = papersBuilder.buildAgentDoc(false);
export const papersFeatureDoc = (includeChangelog: boolean) =>
	papersBuilder.buildFeatureDoc(includeChangelog);

const papersCommand = papersBuilder.build();
export default papersCommand;
