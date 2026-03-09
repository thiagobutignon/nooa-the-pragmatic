import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
	DesktopBridgeRequest,
	DesktopBridgeResponse,
	DesktopEvent,
	DesktopSessionState,
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
- If you need to inspect a file, prefer a read action.
- If you are writing a file, include the complete final content in action.content.
- If you are deleting a file, explain why in action.reason.
- If no filesystem action is needed, set action to null.
- Never mention JSON formatting instructions in assistantMarkdown.`;

function createAiEngine(): AiEngine {
	const engine = new AiEngine();
	engine.register(new OllamaProvider());
	engine.register(new OpenAiProvider());
	engine.register(new GroqProvider());
	engine.register(new MockProvider());
	return engine;
}

function getStatePath(workspacePath: string, sessionId: string): string {
	return resolve(workspacePath, ".nooa", "desktop", `${sessionId}.json`);
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
		return {
			...parsed,
			mode,
			workspacePath,
		};
	} catch {
		return {
			sessionId,
			workspacePath,
			mode,
			history: [],
			pendingApproval: null,
		};
	}
}

async function saveState(state: DesktopSessionState): Promise<void> {
	const statePath = getStatePath(state.workspacePath, state.sessionId);
	await mkdir(dirname(statePath), { recursive: true });
	await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
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
		const parsed = JSON.parse(jsonText) as Partial<ModelEnvelope>;
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

	const completion = await completeWithModel(state);
	state.history.push({
		role: "assistant",
		content: completion.assistantMarkdown,
	});
	events.push({ type: "assistant", markdown: completion.assistantMarkdown });

	if (completion.action) {
		const action: DesktopActionRequest = {
			requestId: randomUUID(),
			kind: completion.action.kind,
			path: completion.action.path,
			content: completion.action.content,
			reason: completion.action.reason,
		};

		if (state.mode === "ask_first") {
			state.pendingApproval = action;
			events.push({ type: "approval_requested", request: action });
		} else {
			const toolEvent = await executeAction(state.workspacePath, action);
			events.push(toolEvent);
		}
	}

	await saveState(state);
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		mode: state.mode,
		events,
	};
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
	if (!pending) {
		return {
			sessionId: state.sessionId,
			workspacePath: state.workspacePath,
			mode: state.mode,
			events: [{ type: "error", message: "No pending approval request." }],
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
			role: "assistant",
			content: `Approved action executed on \`${pending.path}\`.`,
		});
	} else {
		state.history.push({
			role: "assistant",
			content: `User denied the requested \`${pending.kind}\` action on \`${pending.path}\`.`,
		});
		events.push({
			type: "assistant",
			markdown: `Action denied for \`${pending.path}\`.`,
		});
	}

	await saveState(state);
	return {
		sessionId: state.sessionId,
		workspacePath: state.workspacePath,
		mode: state.mode,
		events,
	};
}

async function main(): Promise<void> {
	const stdin = await Bun.stdin.text();
	const request = JSON.parse(stdin) as DesktopBridgeRequest;
	let response: DesktopBridgeResponse;

	if (request.type === "send_message") {
		response = await handleSendMessage(request);
	} else {
		response = await handleApprovalDecision(request);
	}

	process.stdout.write(`${JSON.stringify(response)}\n`);
}

void main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
