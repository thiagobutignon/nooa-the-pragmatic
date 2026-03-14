import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
	DesktopBootstrapResponse,
	DesktopBridgeRequest,
	DesktopBridgeResponse,
	DesktopConversationEntry,
} from "./contracts";

const repoRoot = resolve(import.meta.dir, "../../..");
const bridgePath = resolve(import.meta.dir, "bridge.ts");
const workspaces: string[] = [];

async function callBridge(
	request: DesktopBridgeRequest,
): Promise<DesktopBootstrapResponse | DesktopBridgeResponse> {
	const proc = Bun.spawn(["bun", bridgePath], {
		cwd: repoRoot,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});

	proc.stdin.write(`${JSON.stringify(request)}\n`);
	proc.stdin.end();

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	expect(exitCode).toBe(0);
	expect(stderr.trim()).toBe("");
	return JSON.parse(stdout);
}

async function createWorkspace(): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), "nooa-desktop-bridge-"));
	workspaces.push(workspace);
	return workspace;
}

function expectBootstrap(
	response: DesktopBootstrapResponse | DesktopBridgeResponse,
): DesktopBootstrapResponse {
	expect("recentWorkspaces" in response).toBe(true);
	return response as DesktopBootstrapResponse;
}

function expectSession(
	response: DesktopBootstrapResponse | DesktopBridgeResponse,
): DesktopBridgeResponse {
	expect("sessionId" in response).toBe(true);
	return response as DesktopBridgeResponse;
}

function findConversation(
	conversations: DesktopConversationEntry[],
	sessionId: string,
): DesktopConversationEntry {
	const conversation = conversations.find(
		(entry) => entry.sessionId === sessionId,
	);
	expect(conversation).toBeDefined();
	return conversation as DesktopConversationEntry;
}

describe("desktop bridge conversation management", () => {
	afterEach(async () => {
		await Promise.all(
			workspaces
				.splice(0)
				.map((workspace) => rm(workspace, { recursive: true, force: true })),
		);
	});

	test("archiving the active session restores the next active session", async () => {
		const workspace = await createWorkspace();
		const first = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);
		const second = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);

		const archived = expectBootstrap(
			await callBridge({
				type: "archive_session",
				workspacePath: workspace,
				sessionId: second.sessionId,
			}),
		);

		expect(archived.session?.sessionId).toBe(first.sessionId);
		expect(
			findConversation(archived.conversations, second.sessionId).archived,
		).toBe(true);
	});

	test("deleting the active session removes it and restores the next active session", async () => {
		const workspace = await createWorkspace();
		const first = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);
		const second = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);

		const deleted = expectBootstrap(
			await callBridge({
				type: "delete_session",
				workspacePath: workspace,
				sessionId: second.sessionId,
			}),
		);

		expect(deleted.session?.sessionId).toBe(first.sessionId);
		expect(
			deleted.conversations.some(
				(entry) => entry.sessionId === second.sessionId,
			),
		).toBe(false);
	});

	test("bootstrap returns no active session when every conversation is archived", async () => {
		const workspace = await createWorkspace();
		const session = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);

		await callBridge({
			type: "archive_session",
			workspacePath: workspace,
			sessionId: session.sessionId,
		});

		const bootstrap = expectBootstrap(
			await callBridge({
				type: "bootstrap",
				workspacePath: workspace,
			}),
		);

		expect(bootstrap.session).toBeNull();
		expect(
			findConversation(bootstrap.conversations, session.sessionId).archived,
		).toBe(true);
	});

	test("forget_workspace removes the workspace from recents", async () => {
		const workspace = await createWorkspace();
		expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspace,
				mode: "ask_first",
			}),
		);

		const forgotten = expectBootstrap(
			await callBridge({
				type: "forget_workspace",
				workspacePath: workspace,
			}),
		);

		expect(
			forgotten.recentWorkspaces.some((entry) => entry.path === workspace),
		).toBe(false);
	});

	test("bootstrap without a path prefers a workspace with a saved conversation over a newer empty workspace", async () => {
		const workspaceWithConversation = await createWorkspace();
		const emptyWorkspace = await createWorkspace();

		const session = expectSession(
			await callBridge({
				type: "new_session",
				workspacePath: workspaceWithConversation,
				mode: "ask_first",
			}),
		);

		expectBootstrap(
			await callBridge({
				type: "bootstrap",
				workspacePath: emptyWorkspace,
			}),
		);

		const bootstrap = expectBootstrap(
			await callBridge({
				type: "bootstrap",
			}),
		);

		expect(bootstrap.session?.sessionId).toBe(session.sessionId);
		expect(bootstrap.session?.workspacePath).toBe(workspaceWithConversation);
	});

	test("open_session rejects session ids that escape the desktop state directory", async () => {
		const workspace = await createWorkspace();
		const outsidePath = join(workspace, "outside.json");
		await writeFile(
			outsidePath,
			JSON.stringify({
				sessionId: "outside",
				workspacePath: workspace,
				mode: "ask_first",
				history: [],
				events: [],
				pendingApproval: null,
			}),
		);

		const proc = Bun.spawn(["bun", bridgePath], {
			cwd: repoRoot,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});

		proc.stdin.write(
			`${JSON.stringify({
				type: "open_session",
				workspacePath: workspace,
				sessionId: "../outside",
				mode: "ask_first",
			})}\n`,
		);
		proc.stdin.end();

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		expect(exitCode).toBe(1);
		expect(stdout.trim()).toBe("");
		expect(stderr).toContain("outside the desktop session directory");
		expect(await readFile(outsidePath, "utf8")).toContain('"sessionId":"outside"');
	});
});
