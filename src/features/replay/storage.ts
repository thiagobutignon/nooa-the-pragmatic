import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ReplayNode = {
	id: string;
	label: string;
	type: "step" | "fix";
	createdAt: string;
	meta?: {
		command?: string;
		files?: string[];
		summary?: string;
		tags?: string[];
	};
	fixOf?: string;
};

export type ReplayEdge = {
	from: string;
	to: string;
	kind: "next" | "impact" | "fixes";
};

export type ReplayGraph = {
	version: string;
	nodes: ReplayNode[];
	edges: ReplayEdge[];
};

export function getReplayPath(root: string) {
	return join(root, ".nooa", "replay.json");
}

export async function loadReplay(root: string): Promise<ReplayGraph> {
	const filePath = getReplayPath(root);
	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as ReplayGraph;
		return {
			version: parsed.version ?? "1.0.0",
			nodes: parsed.nodes ?? [],
			edges: parsed.edges ?? [],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.toLowerCase().includes("no such file")) {
			return { version: "1.0.0", nodes: [], edges: [] };
		}
		throw error;
	}
}

export async function saveReplay(root: string, data: ReplayGraph) {
	const dir = join(root, ".nooa");
	await mkdir(dir, { recursive: true });
	const filePath = getReplayPath(root);
	await writeFile(filePath, JSON.stringify(data, null, 2));
}
