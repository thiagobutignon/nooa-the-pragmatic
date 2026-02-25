import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { type AgentDocMeta, type SdkResult, sdkError } from "../../core/types";

export const papersMeta: AgentDocMeta = {
	name: "papers",
	description: "Fetch the latest AI research papers from arXiv",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const papersHelp = `
Usage: nooa papers [flags]

Fetch the latest AI research papers from arXiv.

Flags:
  --limit <n>    Number of papers to return (1-20, default: 5).
  --topic <cat>  arXiv category or search query (default: cs.AI).
  --json         Output structured JSON.
  -h, --help     Show help message.

Examples:
  nooa papers
  nooa papers --limit 3 --json
  nooa papers --topic cs.LG
  nooa papers --json | nooa ai "summarize these papers"

Exit Codes:
  0: Success
  1: Runtime Error (fetch or parse failed)
  2: Validation Error (invalid limit)

Error Codes:
  papers.fetch_failed:  HTTP request to arXiv failed
  papers.parse_failed:  arXiv XML response could not be parsed
  papers.invalid_limit: Limit is not a valid integer between 1 and 20
`;

export const papersSdkUsage = `
SDK Usage:
  const result = await papers.run({ limit: 5, topic: "cs.AI", json: false });
  if (result.ok) {
    for (const paper of result.data.papers) {
      console.log(paper.title, paper.url);
    }
  }
`;

export const papersUsage = {
	cli: "nooa papers [--limit <n>] [--topic <cat>] [--json]",
	sdk: 'await papers.run({ limit: 5, topic: "cs.AI" })',
	tui: "PapersPanel()",
};

export const papersSchema = {
	limit: { type: "string", required: false },
	topic: { type: "string", required: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const papersOutputFields = [
	{ name: "papers", type: "array" },
	{ name: "count", type: "number" },
	{ name: "source", type: "string" },
];

export const papersErrors = [
	{ code: "papers.fetch_failed", message: "HTTP request to arXiv failed." },
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
		input: "nooa papers --limit 3 --topic cs.LG --json",
		output: "Fetch 3 latest Machine Learning papers as JSON.",
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
	topic?: string;
	json?: boolean;
}

export interface PapersRunResult {
	papers: Paper[];
	count: number;
	source: string;
}

function parseArxivXml(xml: string): Paper[] {
	const papers: Paper[] = [];

	// Split on <entry> tags to get individual entries
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
		const authors = authorMatches.map((m) => (m[1] ?? "").trim());

		const title = titleMatch
			? (titleMatch[1]?.replace(/\s+/g, " ").trim() ?? "")
			: "";
		const url = idMatch ? (idMatch[1]?.trim() ?? "") : "";
		const abstract = summaryMatch
			? (summaryMatch[1]?.replace(/\s+/g, " ").trim() ?? "")
			: "";
		const published = publishedMatch ? (publishedMatch[1]?.trim() ?? "") : "";

		if (title && url) {
			papers.push({ title, authors, abstract, url, published });
		}
	}

	return papers;
}

export async function run(
	input: PapersRunInput,
): Promise<SdkResult<PapersRunResult>> {
	const topic = input.topic ?? "cs.AI";
	const limitRaw = input.limit ?? 5;
	const limitNum =
		typeof limitRaw === "string" ? parseInt(limitRaw, 10) : limitRaw;

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

	const url = `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(topic)}&sortBy=submittedDate&sortOrder=descending&max_results=${limitNum}`;

	let responseText: string;
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return {
				ok: false,
				error: sdkError(
					"papers.fetch_failed",
					`arXiv returned HTTP ${response.status}.`,
					{
						status: response.status,
						url,
					},
				),
			};
		}
		responseText = await response.text();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: sdkError("papers.fetch_failed", "Failed to reach arXiv API.", {
				error: message,
				url,
			}),
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
			topic: { type: "string" },
		},
	})
	.parseInput(async ({ values }) => ({
		limit: values.limit as string | undefined,
		topic: values.topic as string | undefined,
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
			console.log(`    Abstract: ${paper.abstract.slice(0, 200)}...`);
			console.log();
		}
	})
	.onFailure((error) => {
		handleCommandError(error, ["papers.invalid_limit"]);
	})
	.telemetry({
		eventPrefix: "papers",
		successMetadata: (input, output) => ({
			count: output.count,
			topic: input.topic ?? "cs.AI",
			limit: input.limit ?? 5,
		}),
		failureMetadata: (input, error) => ({
			error: error.message,
			topic: input.topic,
			limit: input.limit,
		}),
	});

export const papersAgentDoc = papersBuilder.buildAgentDoc(false);
export const papersFeatureDoc = (includeChangelog: boolean) =>
	papersBuilder.buildFeatureDoc(includeChangelog);

const papersCommand = papersBuilder.build();
export default papersCommand;
