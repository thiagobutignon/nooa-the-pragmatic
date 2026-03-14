import { randomUUID } from "node:crypto";
import {
	access,
	mkdir,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { AiEngine } from "../../features/ai/engine";
import { GroqProvider } from "../../features/ai/providers/groq";
import { MockProvider } from "../../features/ai/providers/mock";
import { OllamaProvider } from "../../features/ai/providers/ollama";
import { OpenAiProvider } from "../../features/ai/providers/openai";
import { run as readFileCommand } from "../../features/read/cli";
import type {
	DesktopActionKind,
	DesktopActionRequest,
	DesktopBootstrapResponse,
	DesktopBridgeRequest,
	DesktopBridgeResponse,
	DesktopConversationEntry,
	DesktopEvent,
	DesktopSessionState,
	DesktopWorkspaceEntry,
} from "./contracts";

type ModelEnvelope = {
	assistantMarkdown: string;
	action: null | {
		kind: DesktopActionKind;
		path: string;
		content?: string;
		reason: string;
	};
};

const SYSTEM_PROMPT = `You are NOOA Desktop, a coding agent operating inside a workspace selected by the user.

Return ONLY valid JSON with this exact shape:
{
  "assistantMarkdown": string,
  "action": null | {
    "kind": "read" | "write" | "delete",
    "path": string,
    "content"?: string,
    "reason": string
  }
}

Rules:
- Always keep paths relative to the workspace root.
- Use markdown in assistantMarkdown.
- If the user asks you to create, edit, or delete a file, return a filesystem action instead of only describing it.
- Never claim a file was created, updated, read, or deleted unless you are returning that exact action in the same response or a prior system tool result already confirmed it.
- If you need to inspect a file, prefer a read action.
- If you are writing a file, include the complete final content in action.content.
- If you are deleting a file, explain why in action.reason.
- If no filesystem action is needed, set action to null.
- You may need multiple sequential actions to finish the user's request. After each completed action, continue from the updated workspace state until the task is done.
- Do not ask the user for confirmation inside assistantMarkdown.
- When permission mode is full_access, choose the next filesystem action directly.
- When permission mode is ask_first, describe the plan briefly and return the next pending filesystem action for approval.
- Never mention JSON formatting instructions in assistantMarkdown.`;

const MAX_AGENT_STEPS = 8;
const CONFIRMATION_PATTERN =
	/\b(confirm|confirmation|confirmar|confirme|aprovar|approve|continuar|continue|deseja|prosseguir|proceed)\b/i;

type DesktopRegistry = {
	recentWorkspaces: DesktopWorkspaceEntry[];
};

function createAiEngine(): AiEngine {
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new GroqProvider());
	engine.register(new MockProvider());
	return engine;
}

function getStatePath(workspacePath: string, sessionId: string): string {
	if (
		sessionId.includes("/") ||
		sessionId.includes("\\") ||
		sessionId.includes("..")
	) {
		throw new Error("Session id points outside the desktop session directory.");
	}
	return resolve(workspacePath, ".nooa", "desktop", `${sessionId}.json`);
}

function getDesktopDir(workspacePath: string): string {
	return resolve(workspacePath, ".nooa", "desktop");
}

function getRegistryPath(): string {
	return resolve(homedir(), ".nooa", "desktop", "registry.json");
}

async function loadRegistry(): Promise<DesktopRegistry> {
	try {
		const raw = await readFile(getRegistryPath(), "utf8");
		const parsed = JSON.parse(raw) as Partial<DesktopRegistry>;
		const recentWorkspaces = Array.isArray(parsed.recentWorkspaces)
			? parsed.recentWorkspaces.filter(
					(entry): entry is DesktopWorkspaceEntry =>
						typeof entry?.path === "string" &&
						typeof entry?.lastOpenedAt === "string" &&
						("lastSessionId" in entry
							? entry.lastSessionId === null ||
								typeof entry.lastSessionId === "string"
							: true),
				)
			: [];
		const filtered: DesktopWorkspaceEntry[] = [];
		for (const entry of recentWorkspaces) {
			try {
				await access(entry.path);
				filtered.push(entry);
			} catch {
				// Skip workspaces that no longer exist.
			}
		}
		return {
			recentWorkspaces: filtered,
		};
	} catch {
		return { recentWorkspaces: [] };
	}
}

async function saveRegistry(registry: DesktopRegistry): Promise<void> {
	const registryPath = getRegistryPath();
	await mkdir(dirname(registryPath), { recursive: true });
	await writeFile(
		registryPath,
		`${JSON.stringify(registry, null, 2)}\n`,
		"utf8",
	);
}

async function touchWorkspaceRegistry(
	workspacePath: string,
	sessionId: string | null,
	lastOpenedAt = new Date().toISOString(),
): Promise<DesktopWorkspaceEntry[]> {
	const registry = await loadRegistry();
	const nextEntries = [
		{
			path: workspacePath,
			lastOpenedAt,
			lastSessionId: sessionId,
		},
		...registry.recentWorkspaces.filter(
			(entry) => entry.path !== workspacePath,
		),
	].slice(0, 8);
	await saveRegistry({ recentWorkspaces: nextEntries });
	return nextEntries;
}

async function forgetWorkspaceRegistry(
	workspacePath: string,
): Promise<DesktopWorkspaceEntry[]> {
	const registry = await loadRegistry();
	const nextEntries = registry.recentWorkspaces.filter(
		(entry) => entry.path !== workspacePath,
	);
	await saveRegistry({ recentWorkspaces: nextEntries });
	return nextEntries;
}

async function loadState(
	workspacePath: string,
	sessionId: string,
	mode: DesktopSessionState["mode"],
): Promise<DesktopSessionState> {
	const statePath = getStatePath(workspacePath, sessionId);
	try {
		const raw = await readFile(statePath, "utf8");
		const parsed = JSON.parse(raw) as DesktopSessionState;
		const normalizedEvents = normalizeStoredEvents(
			Array.isArray(parsed.events) ? parsed.events : [],
		);
		const normalizedState: DesktopSessionState = {
			...parsed,
			mode:
				parsed.mode === "full_access" || parsed.mode === "ask_first"
					? parsed.mode
					: mode,
			workspacePath,
			history: rebuildHistoryFromEvents(
				normalizedEvents,
				Array.isArray(parsed.history) ? parsed.history : [],
			),
			events: normalizedEvents,
		};
		if (
			JSON.stringify(normalizedState.events) !==
				JSON.stringify(parsed.events) ||
			JSON.stringify(normalizedState.history) !==
				JSON.stringify(parsed.history) ||
			normalizedState.mode !== parsed.mode
		) {
			await saveState(normalizedState);
		}
		return normalizedState;
	} catch {
		return {
			sessionId,
			workspacePath,
			mode,
			title: "New conversation",
			archived: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			history: [],
			events: [],
			pendingApproval: null,
		};
	}
}

function normalizeStoredEvents(events: DesktopEvent[]): DesktopEvent[] {
	const normalized: DesktopEvent[] = [];
	for (const event of events) {
		const previous = normalized.at(-1);
		if (
			event.type === "assistant" &&
			isConfirmationLike(event.markdown) &&
			previous?.type === "tool_write"
		) {
			continue;
		}
		if (
			event.type === "tool_write" &&
			previous?.type === "tool_write" &&
			previous.path === event.path
		) {
			continue;
		}
		if (
			event.type === "approval_requested" &&
			normalized.some(
				(existing) =>
					existing.type === "approval_requested" &&
					existing.request.requestId === event.request.requestId,
			)
		) {
			continue;
		}
		if (
			event.type === "approval_resolved" &&
			normalized.some(
				(existing) =>
					existing.type === "approval_resolved" &&
					existing.requestId === event.requestId,
			)
		) {
			continue;
		}
		normalized.push(event);
	}
	return normalized;
}

function rebuildHistoryFromEvents(
	events: DesktopEvent[],
	fallbackHistory: DesktopChatMessage[],
): DesktopChatMessage[] {
	const rebuilt = events.flatMap((event): DesktopChatMessage[] => {
		if (event.type === "user") {
			return [{ role: "user", content: event.markdown }];
		}
		if (event.type === "assistant") {
			return [{ role: "assistant", content: event.markdown }];
		}
		if (
			event.type === "tool_read" ||
			event.type === "tool_write" ||
			event.type === "tool_delete"
		) {
			return [{ role: "system", content: summarizeToolEvent(event) }];
		}
		if (event.type === "error") {
			return [{ role: "system", content: event.message }];
		}
		return [];
	});

	return rebuilt.length > 0 ? rebuilt : fallbackHistory;
}

async function saveState(state: DesktopSessionState): Promise<void> {
	state.updatedAt = new Date().toISOString();
	const statePath = getStatePath(state.workspacePath, state.sessionId);
	await mkdir(dirname(statePath), { recursive: true });
	await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function deriveSessionTitle(state: DesktopSessionState): string {
	const firstUserMessage = state.history
		.find((message) => message.role === "user")
		?.content?.trim();
	if (!firstUserMessage) {
		return "New conversation";
	}
	return firstUserMessage.replace(/\s+/g, " ").slice(0, 72);
}

function toConversationEntry(
	state: DesktopSessionState,
): DesktopConversationEntry {
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		title: state.title ?? deriveSessionTitle(state),
		archived: state.archived ?? false,
		createdAt: state.createdAt ?? new Date().toISOString(),
		updatedAt: state.updatedAt ?? new Date().toISOString(),
	};
}

async function getConversationStateMap(
	workspacePath: string,
	mode: DesktopSessionState["mode"],
): Promise<Map<string, DesktopSessionState>> {
	try {
		const files = await readdir(getDesktopDir(workspacePath));
		const states = await Promise.all(
			files
				.filter((file) => file.endsWith(".json"))
				.map(async (file) => {
					const sessionId = file.replace(/\.json$/, "");
					return loadState(workspacePath, sessionId, mode);
				}),
		);
		return new Map(states.map((state) => [state.sessionId, state]));
	} catch {
		return new Map();
	}
}

async function listConversations(
	workspacePath: string,
	mode: DesktopSessionState["mode"],
): Promise<DesktopConversationEntry[]> {
	const states = await getConversationStateMap(workspacePath, mode);
	return [...states.values()]
		.map(toConversationEntry)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getBootstrapSession(
	workspacePath: string,
	lastSessionId: string | null,
): Promise<DesktopSessionState | null> {
	const states = [
		...(await getConversationStateMap(workspacePath, "ask_first")).values(),
	];
	if (states.length === 0) {
		return null;
	}

	const activeStates = states
		.filter((state) => !state.archived)
		.sort((left, right) =>
			(right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
		);
	if (lastSessionId) {
		const matching = activeStates.find(
			(state) => state.sessionId === lastSessionId,
		);
		if (matching) {
			return matching;
		}
	}

	return activeStates[0] ?? null;
}

async function touchWorkspaceWithFallback(
	workspacePath: string,
	preferredSessionId: string | null,
): Promise<{
	recentWorkspaces: DesktopWorkspaceEntry[];
	session: DesktopSessionState | null;
}> {
	const session = await getBootstrapSession(workspacePath, preferredSessionId);
	const recentWorkspaces = await touchWorkspaceRegistry(
		workspacePath,
		session?.sessionId ?? null,
	);
	return { recentWorkspaces, session };
}

async function pickBootstrapWorkspace(
	recentWorkspaces: DesktopWorkspaceEntry[],
	requestedWorkspacePath?: string,
): Promise<string | undefined> {
	if (requestedWorkspacePath) {
		return requestedWorkspacePath;
	}

	for (const workspace of recentWorkspaces) {
		const session = await getBootstrapSession(
			workspace.path,
			workspace.lastSessionId,
		);
		if (session) {
			return workspace.path;
		}
	}

	return recentWorkspaces[0]?.path;
}

function sanitizeModelEnvelope(text: string): ModelEnvelope {
	try {
		const trimmed = text.trim();
		const jsonText =
			trimmed.startsWith("```") && trimmed.endsWith("```")
				? trimmed
						.replace(/^```json\s*/i, "")
						.replace(/^```\s*/i, "")
						.replace(/```$/, "")
				: trimmed;
		const candidate =
			jsonText.match(/```json\s*([\s\S]*?)```/i)?.[1] ??
			jsonText.match(/\{[\s\S]*"assistantMarkdown"[\s\S]*\}/)?.[0] ??
			jsonText;
		const parsed = JSON.parse(candidate) as Partial<ModelEnvelope>;
		return {
			assistantMarkdown:
				typeof parsed.assistantMarkdown === "string"
					? parsed.assistantMarkdown
					: text,
			action:
				parsed.action &&
				typeof parsed.action.kind === "string" &&
				typeof parsed.action.path === "string" &&
				typeof parsed.action.reason === "string"
					? {
							kind: parsed.action.kind as DesktopActionKind,
							path: parsed.action.path,
							content:
								typeof parsed.action.content === "string"
									? parsed.action.content
									: undefined,
							reason: parsed.action.reason,
						}
					: null,
		};
	} catch {
		return {
			assistantMarkdown: text,
			action: null,
		};
	}
}

function ensureInsideWorkspace(
	workspacePath: string,
	requestedPath: string,
): string {
	const absolutePath = isAbsolute(requestedPath)
		? resolve(requestedPath)
		: resolve(workspacePath, requestedPath);
	const rel = relative(workspacePath, absolutePath);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error("Requested path is outside the selected workspace.");
	}
	return absolutePath;
}

function toRelativePath(workspacePath: string, targetPath: string): string {
	const rel = relative(workspacePath, targetPath);
	return rel.length > 0 ? rel : ".";
}

async function executeAction(
	workspacePath: string,
	action: DesktopActionRequest,
): Promise<DesktopEvent> {
	const absolutePath = ensureInsideWorkspace(workspacePath, action.path);
	if (action.kind === "read") {
		const result = await readFileCommand({
			path: absolutePath,
			basePath: workspacePath,
		});
		if (!result.ok) {
			throw new Error(result.error.message);
		}
		return {
			type: "tool_read",
			path: toRelativePath(workspacePath, absolutePath),
			bytes: result.data.bytes,
			preview: result.data.content.slice(0, 500),
		};
	}

	if (action.kind === "write") {
		if (typeof action.content !== "string") {
			throw new Error("Write action missing content.");
		}
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, action.content, "utf8");
		return {
			type: "tool_write",
			path: toRelativePath(workspacePath, absolutePath),
			bytes: Buffer.byteLength(action.content),
		};
	}

	await rm(absolutePath, { force: true });
	return {
		type: "tool_delete",
		path: toRelativePath(workspacePath, absolutePath),
	};
}

function summarizeToolEvent(event: DesktopEvent): string {
	switch (event.type) {
		case "tool_read":
			return [
				`Action completed: read \`${event.path}\`.`,
				`Bytes: ${event.bytes}.`,
				`Preview:`,
				event.preview,
			].join("\n");
		case "tool_write":
			return `Action completed: write \`${event.path}\` (${event.bytes} bytes). This file now exists in the workspace. Continue with the next missing file or finish.`;
		case "tool_delete":
			return `Action completed: delete \`${event.path}\`.`;
		default:
			return "";
	}
}

function isConfirmationLike(markdown: string): boolean {
	return CONFIRMATION_PATTERN.test(markdown);
}

function getActionSignature(action: DesktopActionRequest): string {
	return JSON.stringify({
		kind: action.kind,
		path: action.path,
		content: action.content ?? null,
		reason: action.reason,
	});
}

async function completeWithModel(
	state: DesktopSessionState,
): Promise<ModelEnvelope> {
	const engine = createAiEngine();
	const response = await engine.complete({
		messages: [
			{ role: "system", content: SYSTEM_PROMPT },
			{
				role: "system",
				content: `Workspace root: ${state.workspacePath}\nPermission mode: ${state.mode}`,
			},
			...state.history.map((message) => ({
				role: message.role,
				content: message.content,
			})),
		],
	});

	return sanitizeModelEnvelope(response.content);
}

async function continueAgentTurn(
	state: DesktopSessionState,
	events: DesktopEvent[],
	initialExecutedActions: string[] = [],
): Promise<void> {
	const executedActions = new Set(initialExecutedActions);
	for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
		const completion = await completeWithModel(state);
		state.history.push({
			role: "assistant",
			content: completion.assistantMarkdown,
		});
		events.push({ type: "assistant", markdown: completion.assistantMarkdown });

		if (!completion.action) {
			return;
		}

		const action: DesktopActionRequest = {
			requestId: randomUUID(),
			kind: completion.action.kind,
			path: completion.action.path,
			content: completion.action.content,
			reason: completion.action.reason,
		};
		const actionSignature = getActionSignature(action);
		if (executedActions.has(actionSignature)) {
			state.history.push({
				role: "system",
				content: `Repeated action detected for \`${action.path}\`. Do not repeat the same filesystem action. Continue with the next missing file or finish.`,
			});
			if (isConfirmationLike(completion.assistantMarkdown)) {
				continue;
			}
		}

		if (state.mode === "ask_first") {
			state.pendingApproval = action;
			events.push({ type: "approval_requested", request: action });
			return;
		}

		const toolEvent = await executeAction(state.workspacePath, action);
		executedActions.add(actionSignature);
		events.push(toolEvent);
		state.history.push({
			role: "system",
			content: summarizeToolEvent(toolEvent),
		});
	}

	events.push({
		type: "error",
		message: `Agent stopped after ${MAX_AGENT_STEPS} desktop tool steps.`,
	});
}

async function buildSessionResponse(
	state: DesktopSessionState,
	events: DesktopEvent[],
): Promise<DesktopBridgeResponse> {
	state.events = [...state.events, ...events];
	state.title = deriveSessionTitle(state);
	await saveState(state);
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		mode: state.mode,
		events,
	};
}

async function handleBootstrap(
	request: Extract<DesktopBridgeRequest, { type: "bootstrap" }>,
): Promise<DesktopBootstrapResponse> {
	const recentWorkspaces = (await loadRegistry()).recentWorkspaces;
	const workspacePath = await pickBootstrapWorkspace(
		recentWorkspaces,
		request.workspacePath,
	);
	if (!workspacePath) {
		return {
			recentWorkspaces,
			conversations: [],
			session: null,
		};
	}

	const matchingWorkspace = recentWorkspaces.find(
		(entry) => entry.path === workspacePath,
	);
	const { recentWorkspaces: nextRecentWorkspaces, session } =
		await touchWorkspaceWithFallback(
			workspacePath,
			matchingWorkspace?.lastSessionId ?? null,
		);
	if (!session) {
		return {
			recentWorkspaces: nextRecentWorkspaces,
			conversations: await listConversations(workspacePath, "ask_first"),
			session: null,
		};
	}

	return {
		recentWorkspaces: nextRecentWorkspaces,
		conversations: await listConversations(session.workspacePath, session.mode),
		session: {
			sessionId: session.sessionId,
			workspacePath: session.workspacePath,
			mode: session.mode,
			events: session.events,
		},
	};
}

async function handleNewSession(
	request: Extract<DesktopBridgeRequest, { type: "new_session" }>,
): Promise<DesktopBridgeResponse> {
	const sessionId = randomUUID();
	const state: DesktopSessionState = {
		sessionId,
		workspacePath: request.workspacePath,
		mode: request.mode,
		title: "New conversation",
		archived: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		history: [],
		events: [],
		pendingApproval: null,
	};
	await saveState(state);
	await touchWorkspaceRegistry(state.workspacePath, state.sessionId);
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		mode: state.mode,
		events: [],
	};
}

async function handleOpenSession(
	request: Extract<DesktopBridgeRequest, { type: "open_session" }>,
): Promise<DesktopBridgeResponse> {
	const state = await loadState(
		request.workspacePath,
		request.sessionId,
		request.mode,
	);
	await touchWorkspaceRegistry(state.workspacePath, state.sessionId);
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		mode: state.mode,
		events: state.events,
	};
}

async function handleArchiveSession(
	request: Extract<DesktopBridgeRequest, { type: "archive_session" }>,
): Promise<DesktopBootstrapResponse> {
	const state = await loadState(
		request.workspacePath,
		request.sessionId,
		"ask_first",
	);
	state.archived = true;
	await saveState(state);
	return handleBootstrap({
		type: "bootstrap",
		workspacePath: request.workspacePath,
	});
}

async function handleDeleteSession(
	request: Extract<DesktopBridgeRequest, { type: "delete_session" }>,
): Promise<DesktopBootstrapResponse> {
	await rm(getStatePath(request.workspacePath, request.sessionId), {
		force: true,
	});
	const registry = await loadRegistry();
	const updatedWorkspaces = registry.recentWorkspaces.map((entry) =>
		entry.path === request.workspacePath &&
		entry.lastSessionId === request.sessionId
			? { ...entry, lastSessionId: null }
			: entry,
	);
	await saveRegistry({ recentWorkspaces: updatedWorkspaces });
	return handleBootstrap({
		type: "bootstrap",
		workspacePath: request.workspacePath,
	});
}

async function handleForgetWorkspace(
	request: Extract<DesktopBridgeRequest, { type: "forget_workspace" }>,
): Promise<DesktopBootstrapResponse> {
	return {
		recentWorkspaces: await forgetWorkspaceRegistry(request.workspacePath),
		conversations: [],
		session: null,
	};
}

async function handleSendMessage(
	request: Extract<DesktopBridgeRequest, { type: "send_message" }>,
): Promise<DesktopBridgeResponse> {
	const state = await loadState(
		request.workspacePath,
		request.sessionId,
		request.mode,
	);
	const events: DesktopEvent[] = [];

	if (state.pendingApproval) {
		return {
			sessionId: state.sessionId,
			workspacePath: state.workspacePath,
			mode: state.mode,
			events: [
				{
					type: "error",
					message:
						"Resolve the pending approval request before sending a new message.",
				},
			],
		};
	}

	state.history.push({ role: "user", content: request.message });
	events.push({ type: "user", markdown: request.message });
	await continueAgentTurn(state, events);
	return buildSessionResponse(state, events);
}

async function handleApprovalDecision(
	request: Extract<DesktopBridgeRequest, { type: "approve" | "deny" }>,
): Promise<DesktopBridgeResponse> {
	const state = await loadState(
		request.workspacePath,
		request.sessionId,
		request.mode,
	);
	const pending = state.pendingApproval;
	if (!pending || pending.requestId !== request.requestId) {
		return {
			sessionId: state.sessionId,
			workspacePath: state.workspacePath,
			mode: state.mode,
			events: [
				{
					type: "error",
					message: "No matching pending approval request.",
				},
			],
		};
	}

	const events: DesktopEvent[] = [
		{
			type: "approval_resolved",
			requestId: pending.requestId,
			approved: request.type === "approve",
		},
	];

	state.pendingApproval = null;

	if (request.type === "approve") {
		const toolEvent = await executeAction(state.workspacePath, pending);
		events.push(toolEvent);
		state.history.push({
			role: "system",
			content: summarizeToolEvent(toolEvent),
		});
		await continueAgentTurn(state, events, [getActionSignature(pending)]);
	} else {
		state.history.push({
			role: "system",
			content: `User denied the requested \`${pending.kind}\` action on \`${pending.path}\`.`,
		});
		events.push({
			type: "assistant",
			markdown: `Action denied for \`${pending.path}\`.`,
		});
		await continueAgentTurn(state, events);
	}

	return buildSessionResponse(state, events);
}

async function main(): Promise<void> {
	const stdin = await Bun.stdin.text();
	const request = JSON.parse(stdin) as DesktopBridgeRequest;
	const response =
		request.type === "bootstrap"
			? await handleBootstrap(request)
			: request.type === "new_session"
				? await handleNewSession(request)
				: request.type === "open_session"
					? await handleOpenSession(request)
					: request.type === "archive_session"
						? await handleArchiveSession(request)
						: request.type === "delete_session"
							? await handleDeleteSession(request)
							: request.type === "forget_workspace"
								? await handleForgetWorkspace(request)
								: request.type === "send_message"
									? await handleSendMessage(request)
									: await handleApprovalDecision(request);

	process.stdout.write(`${JSON.stringify(response)}\n`);
}

void main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
