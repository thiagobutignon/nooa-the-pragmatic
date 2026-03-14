import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	DebugRuntime,
	DebugSessionRecord,
	DebugSessionsState,
} from "./types";

function createEmptyState(): DebugSessionsState {
	return {
		version: "1.0.0",
		sessions: {},
	};
}

export function getDebugSessionsPath(root: string) {
	return join(root, ".nooa", "debug", "sessions.json");
}

export async function loadDebugSessions(
	root: string,
): Promise<DebugSessionsState> {
	const filePath = getDebugSessionsPath(root);
	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as Partial<DebugSessionsState>;
		return {
			version: parsed.version ?? "1.0.0",
			sessions: parsed.sessions ?? {},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const normalized = message.toLowerCase();
		if (
			normalized.includes("no such file") ||
			normalized.includes("json parse error")
		) {
			return createEmptyState();
		}
		throw error;
	}
}

async function saveDebugSessions(root: string, state: DebugSessionsState) {
	const dir = join(root, ".nooa", "debug");
	const filePath = getDebugSessionsPath(root);
	const tempPath = `${filePath}.tmp`;
	await mkdir(dir, { recursive: true });
	await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
	await rename(tempPath, filePath);
}

export async function loadDebugSession(
	root: string,
	name: string,
): Promise<DebugSessionRecord | null> {
	const state = await loadDebugSessions(root);
	return state.sessions[name] ?? null;
}

export async function saveDebugSession(
	root: string,
	session: DebugSessionRecord,
) {
	const state = await loadDebugSessions(root);
	state.sessions[session.name] = {
		...session,
		updatedAt: new Date().toISOString(),
	};
	await saveDebugSessions(root, state);
}

export async function createDebugSession(
	root: string,
	input: { name: string; runtime: DebugRuntime },
): Promise<DebugSessionRecord> {
	const timestamp = new Date().toISOString();
	const session: DebugSessionRecord = {
		name: input.name,
		runtime: input.runtime,
		state: "idle",
		createdAt: timestamp,
		updatedAt: timestamp,
		breakpoints: [],
		refs: {
			frames: [],
			values: [],
			breakpoints: [],
		},
	};
	await saveDebugSession(root, session);
	return session;
}

export async function deleteDebugSession(root: string, name: string) {
	const state = await loadDebugSessions(root);
	delete state.sessions[name];
	await saveDebugSessions(root, state);
}

export type { DebugSessionRecord } from "./types";
