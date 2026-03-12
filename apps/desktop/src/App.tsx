import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { FormEvent } from "react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
	DesktopActionRequest,
	DesktopBootstrapResponse,
	DesktopBridgeRequest,
	DesktopBridgeResponse,
	DesktopConversationEntry,
	DesktopEvent,
	DesktopPermissionMode,
	DesktopWorkspaceEntry,
} from "./desktop";

type TimelineEvent = DesktopEvent & {
	id: string;
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForEvent(event: DesktopEvent): string {
	switch (event.type) {
		case "assistant":
			return "AI";
		case "user":
			return "YOU";
		case "tool_read":
			return "READ";
		case "tool_write":
			return "WRITE";
		case "tool_delete":
			return "DEL";
		case "approval_requested":
			return "ASK";
		case "approval_resolved":
			return event.approved ? "OK" : "NO";
		case "error":
			return "ERR";
	}
}

function titleForEvent(event: DesktopEvent): string {
	switch (event.type) {
		case "assistant":
			return "NOOA";
		case "user":
			return "You";
		case "tool_read":
			return "Read file";
		case "tool_write":
			return "Updated file";
		case "tool_delete":
			return "Deleted file";
		case "approval_requested":
			return "Approval required";
		case "approval_resolved":
			return event.approved ? "Action approved" : "Action denied";
		case "error":
			return "Runtime error";
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function enhanceMarkdown(html: string): string {
	return html.replace(
		/(^|[\s(])(`?)([\w./-]+\.[\w.-]+)(`?)(?=[\s).,:;]|$)/g,
		(
			_match: string,
			prefix: string,
			opening: string,
			path: string,
			closing: string,
		) =>
			`${prefix}${opening}<span class="inline-path">${escapeHtml(path)}</span>${closing}`,
	);
}

function MarkdownBlock({ markdown }: { markdown: string }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const html = useMemo(() => {
		const renderer = new marked.Renderer();
		renderer.code = ({ text, lang }) => {
			const language = lang || "text";
			return [
				`<div class="code-shell">`,
				`<div class="code-shell__bar"><span>${escapeHtml(language)}</span><button type="button" data-copy="${encodeURIComponent(
					text,
				)}">copy</button></div>`,
				`<pre><code>${escapeHtml(text)}</code></pre>`,
				`</div>`,
			].join("");
		};
		renderer.link = ({ href, title, text }) => {
			const safeHref = href || "#";
			const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
			return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer"${titleAttribute}>${text}</a>`;
		};
		renderer.blockquote = ({ tokens }) =>
			`<blockquote class="rich-quote">${marked.parser(tokens)}</blockquote>`;
		renderer.table = ({ header, rows }) =>
			`<div class="table-shell"><table><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
		marked.setOptions({
			breaks: true,
			gfm: true,
		});
		return DOMPurify.sanitize(
			enhanceMarkdown(marked.parse(markdown, { renderer }) as string),
		);
	}, [markdown]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		function handleCopyClick(event: Event) {
			const target = event.target;
			if (!(target instanceof HTMLButtonElement)) {
				return;
			}

			const copyText = target.dataset.copy;
			if (!copyText) {
				return;
			}

			void navigator.clipboard.writeText(decodeURIComponent(copyText));
			target.textContent = "copied";
			window.setTimeout(() => {
				target.textContent = "copy";
			}, 1200);
		}

		container.addEventListener("click", handleCopyClick);
		return () => {
			container.removeEventListener("click", handleCopyClick);
		};
	}, []);

	return (
		<div
			className="markdown-block"
			ref={containerRef}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized with DOMPurify before rendering.
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

function EventCard({
	event,
	onApprove,
	onDeny,
	pendingActionId,
	currentApprovalRequestId,
}: {
	event: TimelineEvent;
	onApprove: (request: DesktopActionRequest) => void;
	onDeny: (request: DesktopActionRequest) => void;
	pendingActionId: string | null;
	currentApprovalRequestId: string | null;
}) {
	const cardClass = `event-card event-card--${event.type.replace(/_/g, "-")}`;

	if (event.type === "user" || event.type === "assistant") {
		return (
			<article className={`${cardClass} event-card--message`}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<MarkdownBlock markdown={event.markdown} />
			</article>
		);
	}

	if (event.type === "tool_read") {
		return (
			<article className={cardClass}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<strong>{event.path}</strong>
				<p>{formatBytes(event.bytes)} loaded into the agent context.</p>
				<pre className="preview-box">{event.preview}</pre>
			</article>
		);
	}

	if (event.type === "tool_write") {
		return (
			<article className={cardClass}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<strong>{event.path}</strong>
				<p>{formatBytes(event.bytes)} written by NOOA.</p>
			</article>
		);
	}

	if (event.type === "tool_delete") {
		return (
			<article className={cardClass}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<strong>{event.path}</strong>
				<p>The file was removed from the active workspace.</p>
			</article>
		);
	}

	if (event.type === "approval_requested") {
		const isCurrent = currentApprovalRequestId === event.request.requestId;
		const disabled = pendingActionId === event.request.requestId;
		return (
			<article className={`${cardClass} event-card--approval`}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<strong>
					{event.request.kind.toUpperCase()} {event.request.path}
				</strong>
				<p>{event.request.reason}</p>
				{isCurrent ? (
					<div className="approval-actions">
						<button
							disabled={disabled}
							onClick={() => onApprove(event.request)}
							type="button"
						>
							Approve
						</button>
						<button
							className="button-secondary"
							disabled={disabled}
							onClick={() => onDeny(event.request)}
							type="button"
						>
							Deny
						</button>
					</div>
				) : (
					<p className="approval-note">This request is no longer pending.</p>
				)}
			</article>
		);
	}

	if (event.type === "approval_resolved") {
		return (
			<article className={cardClass}>
				<div className="event-meta">
					<span className="event-pill">{iconForEvent(event)}</span>
					<span>{titleForEvent(event)}</span>
				</div>
				<p>
					Request <code>{event.requestId}</code> was{" "}
					{event.approved ? "approved" : "denied"}.
				</p>
			</article>
		);
	}

	return (
		<article className={cardClass}>
			<div className="event-meta">
				<span className="event-pill">{iconForEvent(event)}</span>
				<span>{titleForEvent(event)}</span>
			</div>
			<p>{event.message}</p>
		</article>
	);
}

function toTimelineEvent(event: DesktopEvent): TimelineEvent {
	return {
		...event,
		id: crypto.randomUUID(),
	};
}

function defaultIntroEvent(): TimelineEvent {
	return {
		id: crypto.randomUUID(),
		type: "assistant",
		markdown:
			"## NOOA Desktop\nChoose a workspace on the left, then ask me to inspect, write, or delete files inside it.",
	};
}

function workspaceIntroEvent(workspacePath: string): TimelineEvent {
	return {
		id: crypto.randomUUID(),
		type: "assistant",
		markdown: `Workspace locked to \`${workspacePath}\`.\n\nAsk me to inspect, create, edit, or remove files inside this folder.`,
	};
}

function findPendingApproval(
	events: DesktopEvent[],
): DesktopActionRequest | null {
	let pending: DesktopActionRequest | null = null;
	for (const event of events) {
		if (event.type === "approval_requested") {
			pending = event.request;
		}
		if (
			event.type === "approval_resolved" &&
			pending?.requestId === event.requestId
		) {
			pending = null;
		}
	}
	return pending;
}

function pushRecentWorkspace(
	current: DesktopWorkspaceEntry[],
	path: string,
	sessionId: string | null,
): DesktopWorkspaceEntry[] {
	return [
		{
			path,
			lastOpenedAt: new Date().toISOString(),
			lastSessionId: sessionId,
		},
		...current.filter((entry) => entry.path !== path),
	].slice(0, 8);
}

function sortConversations(
	items: DesktopConversationEntry[],
): DesktopConversationEntry[] {
	return [...items].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);
}

function App() {
	const [workspacePath, setWorkspacePath] = useState<string>("");
	const [mode, setMode] = useState<DesktopPermissionMode>("ask_first");
	const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
	const [composerValue, setComposerValue] = useState("");
	const [events, setEvents] = useState<TimelineEvent[]>([defaultIntroEvent()]);
	const [recentWorkspaces, setRecentWorkspaces] = useState<
		DesktopWorkspaceEntry[]
	>([]);
	const [conversations, setConversations] = useState<
		DesktopConversationEntry[]
	>([]);
	const [pendingApproval, setPendingApproval] =
		useState<DesktopActionRequest | null>(null);
	const [pendingActionId, setPendingActionId] = useState<string | null>(null);
	const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const approvalLockRef = useRef<string | null>(null);

	function applySessionSnapshot(session: DesktopBridgeResponse | null) {
		if (!session) {
			return;
		}

		setWorkspacePath(session.workspacePath);
		setSessionId(session.sessionId);
		setMode(session.mode);
		setEvents(
			session.events.length > 0
				? session.events.map(toTimelineEvent)
				: [workspaceIntroEvent(session.workspacePath)],
		);
		setPendingApproval(findPendingApproval(session.events));
		setPendingActionId(null);
		approvalLockRef.current = null;
		setQueuedMessages([]);
	}

	function createFreshWorkspaceSession(path: string) {
		setWorkspacePath(path);
		setSessionId(crypto.randomUUID());
		setPendingApproval(null);
		setPendingActionId(null);
		approvalLockRef.current = null;
		setQueuedMessages([]);
		setConversations([]);
		setEvents([workspaceIntroEvent(path)]);
	}

	const bootstrapWorkspace = useEffectEvent(async (path?: string) => {
		const response = await invoke<DesktopBootstrapResponse>("desktop_bridge", {
			request: path
				? { type: "bootstrap", workspacePath: path }
				: { type: "bootstrap" },
		});
		setRecentWorkspaces(response.recentWorkspaces);
		setConversations(sortConversations(response.conversations));
		if (response.session) {
			applySessionSnapshot(response.session);
			return true;
		}
		return false;
	});

	const startNewSession = useEffectEvent(async () => {
		if (!workspacePath) {
			return;
		}

		const response = await invoke<DesktopBridgeResponse>("desktop_bridge", {
			request: {
				type: "new_session",
				workspacePath,
				mode,
			},
		});
		setRecentWorkspaces((current) =>
			pushRecentWorkspace(current, response.workspacePath, response.sessionId),
		);
		setConversations((current) =>
			sortConversations([
				{
					sessionId: response.sessionId,
					workspacePath: response.workspacePath,
					title: "New conversation",
					archived: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				...current.filter((entry) => entry.sessionId !== response.sessionId),
			]),
		);
		setSessionId(response.sessionId);
		setPendingApproval(null);
		setPendingActionId(null);
		setQueuedMessages([]);
		setEvents([workspaceIntroEvent(response.workspacePath)]);
	});

	useEffect(() => {
		void bootstrapWorkspace();
	}, []);

	async function chooseWorkspace() {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Choose a workspace for NOOA Desktop",
		});
		if (typeof selected !== "string") {
			return;
		}

		const restored = await bootstrapWorkspace(selected);
		if (!restored) {
			createFreshWorkspaceSession(selected);
			setRecentWorkspaces((current) =>
				pushRecentWorkspace(current, selected, null),
			);
		}
	}

	async function callBridge(request: DesktopBridgeRequest) {
		const response = await invoke<DesktopBridgeResponse>("desktop_bridge", {
			request,
		});
		setSessionId(response.sessionId);
		const approvalEvent = response.events.find(
			(event) => event.type === "approval_requested",
		);
		const resolutionEvent = response.events.find(
			(event) => event.type === "approval_resolved",
		);
		if (approvalEvent?.type === "approval_requested") {
			setPendingApproval(approvalEvent.request);
		} else if (resolutionEvent?.type === "approval_resolved") {
			setPendingApproval(null);
		}
		setEvents((current) => [
			...current,
			...response.events.map((event) => ({
				...event,
				id: crypto.randomUUID(),
			})),
		]);
		const firstUserEvent = response.events.find(
			(event): event is Extract<DesktopEvent, { type: "user" }> =>
				event.type === "user",
		);
		setConversations((current) =>
			sortConversations([
				{
					sessionId: response.sessionId,
					workspacePath: response.workspacePath,
					title:
						current.find((entry) => entry.sessionId === response.sessionId)
							?.title ??
						firstUserEvent?.markdown ??
						"New conversation",
					archived: false,
					createdAt:
						current.find((entry) => entry.sessionId === response.sessionId)
							?.createdAt ?? new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				...current.filter((entry) => entry.sessionId !== response.sessionId),
			]),
		);
	}

	async function refreshBootstrap(path: string) {
		const response = await invoke<DesktopBootstrapResponse>("desktop_bridge", {
			request: { type: "bootstrap", workspacePath: path },
		});
		setRecentWorkspaces(response.recentWorkspaces);
		setConversations(sortConversations(response.conversations));
		if (response.session) {
			applySessionSnapshot(response.session);
			return;
		}
		createFreshWorkspaceSession(path);
	}

	async function openConversation(targetSessionId: string) {
		if (!workspacePath || isRunning || targetSessionId === sessionId) {
			return;
		}

		setIsRunning(true);
		try {
			const response = await invoke<DesktopBridgeResponse>("desktop_bridge", {
				request: {
					type: "open_session",
					workspacePath,
					sessionId: targetSessionId,
					mode,
				},
			});
			applySessionSnapshot(response);
			setRecentWorkspaces((current) =>
				pushRecentWorkspace(
					current,
					response.workspacePath,
					response.sessionId,
				),
			);
		} finally {
			setIsRunning(false);
		}
	}

	async function mutateConversation(
		request: Extract<
			DesktopBridgeRequest,
			{ type: "archive_session" | "delete_session" }
		>,
	) {
		if (!workspacePath || isRunning) {
			return;
		}

		setIsRunning(true);
		try {
			await invoke("desktop_bridge", { request });
			await refreshBootstrap(workspacePath);
		} catch (error) {
			setEvents((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					type: "error",
					message: error instanceof Error ? error.message : String(error),
				},
			]);
		} finally {
			setIsRunning(false);
		}
	}

	const activeConversations = conversations.filter((entry) => !entry.archived);
	const archivedConversations = conversations.filter((entry) => entry.archived);

	async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const message = composerValue.trim();
		if (!message || !workspacePath || pendingApproval) {
			return;
		}

		setComposerValue("");
		if (isRunning) {
			setQueuedMessages((current) => [...current, message]);
			return;
		}

		setQueuedMessages((current) => [...current, message]);
	}

	async function resolveApproval(
		request: DesktopActionRequest,
		approved: boolean,
	) {
		if (
			isRunning ||
			request.requestId !== pendingApproval?.requestId ||
			approvalLockRef.current !== null
		) {
			return;
		}

		approvalLockRef.current = request.requestId;
		setIsRunning(true);
		setPendingActionId(request.requestId);
		try {
			await callBridge({
				type: approved ? "approve" : "deny",
				sessionId,
				workspacePath,
				mode,
				requestId: request.requestId,
			});
		} catch (error) {
			setEvents((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					type: "error",
					message: error instanceof Error ? error.message : String(error),
				},
			]);
		} finally {
			approvalLockRef.current = null;
			setPendingActionId(null);
			setIsRunning(false);
		}
	}

	const processQueuedMessage = useEffectEvent(async (message: string) => {
		setIsRunning(true);
		try {
			await callBridge({
				type: "send_message",
				sessionId,
				workspacePath,
				mode,
				message,
			});
		} catch (error) {
			setEvents((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					type: "error",
					message: error instanceof Error ? error.message : String(error),
				},
			]);
		} finally {
			setIsRunning(false);
		}
	});

	useEffect(() => {
		if (
			isRunning ||
			pendingApproval ||
			queuedMessages.length === 0 ||
			!workspacePath
		) {
			return;
		}

		const [nextMessage, ...remaining] = queuedMessages;
		if (!nextMessage) {
			return;
		}

		setQueuedMessages(remaining);
		void processQueuedMessage(nextMessage);
	}, [isRunning, pendingApproval, queuedMessages, workspacePath]);

	async function forgetWorkspace(path: string) {
		await invoke("desktop_bridge", {
			request: {
				type: "forget_workspace",
				workspacePath: path,
			},
		});
		setRecentWorkspaces((current) =>
			current.filter((entry) => entry.path !== path),
		);
	}

	return (
		<main className="app-shell">
			{isSidebarOpen ? (
				<aside className="sidebar glass-panel">
					<div className="brand-block">
						<div className="section-head">
							<span className="brand-kicker">LOCAL AGENT</span>
							<button
								className="button-secondary sidebar-toggle"
								onClick={() => setIsSidebarOpen(false)}
								type="button"
							>
								Close
							</button>
						</div>
						<h1>NOOA Desktop</h1>
						<p>
							Chat-driven coding workspace with file actions rendered as
							first-class events.
						</p>
					</div>

					<section className="sidebar-section">
						<div className="section-head">
							<span>Workspace</span>
							<div className="section-actions">
								<button
									className="button-secondary"
									onClick={() => void startNewSession()}
									type="button"
								>
									New chat
								</button>
								<button
									className="button-secondary"
									onClick={chooseWorkspace}
									type="button"
								>
									Choose folder
								</button>
							</div>
						</div>
						<div className="workspace-card">
							<span className="status-dot" />
							<div>
								<strong>{workspacePath || "No workspace selected"}</strong>
								<p>
									NOOA stays locked to this folder for reads, writes, and
									deletes.
								</p>
							</div>
						</div>
						{recentWorkspaces.length > 0 ? (
							<div className="recent-list">
								{recentWorkspaces.map((entry) => (
									<div
										className={`recent-workspace${
											entry.path === workspacePath ? " is-current" : ""
										}`}
										key={entry.path}
									>
										<button
											className="recent-workspace__body"
											onClick={() => {
												void bootstrapWorkspace(entry.path);
											}}
											type="button"
										>
											<strong>{entry.path}</strong>
											<span>
												{new Date(entry.lastOpenedAt).toLocaleString()}
											</span>
										</button>
										<button
											className="button-secondary recent-workspace__remove"
											onClick={() => void forgetWorkspace(entry.path)}
											type="button"
										>
											Remove
										</button>
									</div>
								))}
							</div>
						) : null}
					</section>

					<section className="sidebar-section">
						<div className="section-head">
							<span>Permission mode</span>
						</div>
						<div className="mode-toggle">
							<button
								className={mode === "full_access" ? "is-active" : ""}
								onClick={() => setMode("full_access")}
								type="button"
							>
								Full Access
							</button>
							<button
								className={mode === "ask_first" ? "is-active" : ""}
								onClick={() => setMode("ask_first")}
								type="button"
							>
								Ask First
							</button>
						</div>
						<p className="mode-copy">
							{mode === "full_access"
								? "NOOA executes read, write, and delete operations immediately."
								: "Every filesystem action generates an approval card inside the chat."}
						</p>
					</section>

					<section className="sidebar-section">
						<div className="section-head">
							<span>Conversations</span>
						</div>
						<div className="conversation-list">
							{activeConversations.length > 0 ? (
								activeConversations.map((entry) => (
									<article
										className={`conversation-card${
											entry.sessionId === sessionId ? " is-current" : ""
										}`}
										key={entry.sessionId}
									>
										<button
											className="conversation-card__body"
											onClick={() => void openConversation(entry.sessionId)}
											type="button"
										>
											<strong>{entry.title}</strong>
											<span>{new Date(entry.updatedAt).toLocaleString()}</span>
										</button>
										<div className="conversation-card__actions">
											<button
												className="button-secondary"
												disabled={isRunning}
												onClick={() =>
													void mutateConversation({
														type: "archive_session",
														workspacePath,
														sessionId: entry.sessionId,
													})
												}
												type="button"
											>
												Archive
											</button>
											<button
												className="button-secondary danger-button"
												disabled={isRunning}
												onClick={() =>
													void mutateConversation({
														type: "delete_session",
														workspacePath,
														sessionId: entry.sessionId,
													})
												}
												type="button"
											>
												Delete
											</button>
										</div>
									</article>
								))
							) : (
								<p className="empty-copy">No active conversations yet.</p>
							)}
						</div>
						{archivedConversations.length > 0 ? (
							<>
								<div className="section-head">
									<span>Archived</span>
								</div>
								<div className="conversation-list">
									{archivedConversations.map((entry) => (
										<article
											className="conversation-card is-archived"
											key={entry.sessionId}
										>
											<button
												className="conversation-card__body"
												onClick={() => void openConversation(entry.sessionId)}
												type="button"
											>
												<strong>{entry.title}</strong>
												<span>
													{new Date(entry.updatedAt).toLocaleString()}
												</span>
											</button>
											<div className="conversation-card__actions">
												<button
													className="button-secondary danger-button"
													disabled={isRunning}
													onClick={() =>
														void mutateConversation({
															type: "delete_session",
															workspacePath,
															sessionId: entry.sessionId,
														})
													}
													type="button"
												>
													Delete
												</button>
											</div>
										</article>
									))}
								</div>
							</>
						) : null}
					</section>

					<section className="sidebar-section sidebar-section--summary">
						<div className="mini-stat">
							<span>Session</span>
							<strong>{sessionId.slice(0, 8)}</strong>
						</div>
						<div className="mini-stat">
							<span>Status</span>
							<strong>
								{isRunning
									? "Thinking"
									: pendingApproval
										? "Waiting approval"
										: "Idle"}
							</strong>
						</div>
					</section>
				</aside>
			) : null}

			<section className="chat-column">
				<header className="chat-header glass-panel">
					<div>
						<button
							className="button-secondary sidebar-toggle"
							onClick={() => setIsSidebarOpen((current) => !current)}
							type="button"
						>
							{isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
						</button>
						<span className="brand-kicker">CHAT SESSION</span>
						<h2>Workspace agent</h2>
					</div>
					<p>
						Markdown responses, tool telemetry, and approvals all live in the
						same timeline.
					</p>
				</header>

				<div className="timeline">
					{events.map((event) => (
						<EventCard
							event={event}
							key={event.id}
							currentApprovalRequestId={pendingApproval?.requestId ?? null}
							onApprove={(request) => void resolveApproval(request, true)}
							onDeny={(request) => void resolveApproval(request, false)}
							pendingActionId={pendingActionId}
						/>
					))}
				</div>

				<form className="composer glass-panel" onSubmit={handleSendMessage}>
					<textarea
						disabled={!workspacePath || Boolean(pendingApproval)}
						onChange={(event) => setComposerValue(event.currentTarget.value)}
						placeholder={
							workspacePath
								? "Ask NOOA to inspect, edit, or remove files inside the selected folder..."
								: "Choose a workspace to start"
						}
						rows={4}
						value={composerValue}
					/>
					<div className="composer-actions">
						<span>
							{pendingApproval
								? "Resolve the pending approval card before sending a new request."
								: queuedMessages.length > 0
									? `${queuedMessages.length} message(s) waiting in queue.`
									: "Responses are rendered as polished markdown plus structured file events."}
						</span>
						<button
							disabled={
								!workspacePath ||
								Boolean(pendingApproval) ||
								!composerValue.trim()
							}
							type="submit"
						>
							{isRunning ? "Queue" : "Send"}
						</button>
					</div>
				</form>
			</section>
		</main>
	);
}

export default App;
