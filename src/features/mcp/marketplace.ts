import { parseArgs } from "node:util";

type MarketplaceResponseEntry = {
	id: string;
	name: string;
	description?: string;
	verified?: boolean;
	tags?: string[];
};

type FetchLibsResponse = {
	libs: MarketplaceResponseEntry[];
};

const SEARCH_BASE = "https://context7.com/api/v2/libs/search";

function parseLimit(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function filterVerified(
	values: { "verified-only"?: boolean },
	libs: MarketplaceResponseEntry[],
): MarketplaceResponseEntry[] {
	if (!values["verified-only"]) return libs;
	return libs.filter(
		(entry) => entry.verified || entry.tags?.includes("verified"),
	);
}

function buildTable(libs: MarketplaceResponseEntry[], limit: number) {
	return libs.slice(0, limit).map((entry) => ({
		id: entry.id,
		name: entry.name,
		description: entry.description || "",
		verified: entry.verified ? "yes" : "no",
	}));
}

async function fetchMarketplace(
	query: string,
	library?: string,
	headers?: Record<string, string>,
): Promise<MarketplaceResponseEntry[]> {
	const params = new URLSearchParams();
	params.set("query", query);
	if (library) {
		params.set("libraryName", library);
	}
	const url = `${SEARCH_BASE}?${params.toString()}`;
	const response = await fetch(url, {
		headers,
	});
	if (!response.ok) {
		throw new Error(`Context7 API error: ${response.status}`);
	}
	const payload = (await response.json()) as FetchLibsResponse;
	return payload.libs || [];
}

export async function marketplaceCommand(rawArgs: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: rawArgs,
		options: {
			help: { type: "boolean", short: "h" },
			json: { type: "boolean" },
			"verified-only": { type: "boolean" },
			limit: { type: "string" },
			"library-name": { type: "string" },
			"api-key": { type: "string" },
		},
		allowPositionals: true,
		strict: false,
	});

	if (values.help || positionals.length === 0) {
		console.log(`Usage: nooa mcp marketplace <query> [flags]

Flags:
  --library-name <name>  Scope the search to a specific library
  --verified-only        Only show curated/verified libraries
  --limit <n>            Max number of entries to return (default: 10)
  --api-key <key>        Context7 API key (falls back to CONTEXT7_API_KEY)
  --json                 Emit JSON output
  -h, --help             Show this help message`);
		return 0;
	}

	const query = positionals.join(" ");
	const apiKey =
		typeof values["api-key"] === "string" && values["api-key"].trim()
			? values["api-key"].trim()
			: process.env.CONTEXT7_API_KEY;
	const headers: Record<string, string> = {};
	if (apiKey) {
		headers.Authorization = `Bearer ${apiKey}`;
	}

	try {
		const libs = await fetchMarketplace(
			query,
			values["library-name"] as string | undefined,
			apiKey ? headers : undefined,
		);
		const filtered = filterVerified(values, libs);
		const limit = parseLimit(values.limit as string | undefined, 10);
		if (values.json) {
			console.log(
				JSON.stringify({ entries: filtered.slice(0, limit) }, null, 2),
			);
		} else {
			const table = buildTable(filtered, limit);
			if (table.length === 0) {
				console.log("No entries found.");
				return 0;
			}
			for (const entry of table) {
				console.log(
					`${entry.name} (${entry.verified})\n  ${entry.description}\n  id: ${entry.id}`,
				);
			}
		}
		return 0;
	} catch (error) {
		console.error(
			"Marketplace search failed:",
			error instanceof Error ? error.message : error,
		);
		return 1;
	}
}
