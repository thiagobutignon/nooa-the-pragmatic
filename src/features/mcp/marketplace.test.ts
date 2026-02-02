import { expect, test } from "bun:test";
import { marketplaceCommand } from "./marketplace";

const sampleLibs = [
	{
		id: "fs",
		name: "filesystem",
		description: "File-based MCP",
		verified: true,
	},
	{ id: "gh", name: "github", description: "GitHub MCP", verified: false },
	{ id: "db", name: "db", description: "Database MCP", tags: ["verified"] },
];

async function withFetchMock(fn: () => Promise<number>) {
	const originalFetch = globalThis.fetch;
	let requestedUrl: string | null = null;
	let requestedHeaders: Record<string, string> | undefined;
	globalThis.fetch = async (input: RequestInfo) => {
		if (typeof input === "string") {
			requestedUrl = input;
		}
		return {
			ok: true,
			json: async () => ({ libs: sampleLibs }),
			status: 200,
		} as Response;
	};

	try {
		const exitCode = await fn();
		return { exitCode, requestedUrl, requestedHeaders };
	} finally {
		globalThis.fetch = originalFetch;
	}
}

test("marketing command prints results", async () => {
	const { exitCode, requestedUrl } = await withFetchMock(() =>
		marketplaceCommand(["search-term"]),
	);
	expect(exitCode).toBe(0);
	expect(requestedUrl).toContain("query=search-term");
});

test("marketplace supports verified-only filter", async () => {
	const { exitCode } = await withFetchMock(() =>
		marketplaceCommand(["search-term", "--verified-only"]),
	);
	expect(exitCode).toBe(0);
});

test("marketplace emits JSON output", async () => {
	let logs = "";
	const originalLog = console.log;
	console.log = (msg: string) => {
		logs += msg;
	};
	const { exitCode } = await withFetchMock(() =>
		marketplaceCommand(["search-term", "--json"]),
	);
	console.log = originalLog;
	expect(exitCode).toBe(0);
	expect(logs).toContain('"entries":');
});
