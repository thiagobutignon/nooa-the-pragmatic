import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type EvalHistoryEntry = {
	id: string;
	prompt: string;
	suite: string;
	command: "run" | "apply" | "suggest" | "report" | "history" | "compare";
	totalScore: number;
	judge?: string;
	timestamp: string;
	meta?: Record<string, unknown>;
};

const DEFAULT_HISTORY_FILE = ".nooa/eval-history.json";

export function getHistoryPath(cwd: string = process.cwd(), override?: string) {
	const envOverride = process.env.NOOA_EVAL_HISTORY;
	if (override) {
		return resolve(override);
	}
	if (envOverride) {
		return resolve(envOverride);
	}
	return join(cwd, DEFAULT_HISTORY_FILE);
}

export async function loadHistory(
	cwd: string = process.cwd(),
	overrideFile?: string,
) {
	const dataOverride = process.env.NOOA_EVAL_HISTORY_DATA;
	if (dataOverride) {
		try {
			const parsed = JSON.parse(dataOverride) as EvalHistoryEntry[];
			return parsed;
		} catch {
			// Fall through to file-based loading if the JSON is invalid.
		}
	}

	const historyPath = getHistoryPath(cwd, overrideFile);
	if (!existsSync(historyPath)) {
		return [];
	}

	try {
		const content = await readFile(historyPath, "utf-8");
		if (!content) return [];
		return JSON.parse(content) as EvalHistoryEntry[];
	} catch {
		return [];
	}
}

export async function appendHistory(
	entry: Omit<EvalHistoryEntry, "timestamp">,
	cwd: string = process.cwd(),
) {
	const historyPath = getHistoryPath(cwd);
	const entries = await loadHistory(cwd);
	const record: EvalHistoryEntry = {
		...entry,
		timestamp: new Date().toISOString(),
	};

	await mkdir(dirname(historyPath), { recursive: true });
	await writeFile(historyPath, JSON.stringify([...entries, record], null, 2));
	return record;
}
