import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
	DesktopActionRequest,
	DesktopBridgeRequest,
	DesktopBridgeResponse,
	DesktopEvent,
	DesktopPermissionMode,
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
	hasPendingApproval,
}: {
	event: TimelineEvent;
	onApprove: (request: DesktopActionRequest) => void;
	onDeny: (request: DesktopActionRequest) => void;
	pendingActionId: string | null;
	hasPendingApproval: boolean;
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
		const disabled =
			(hasPendingApproval &&
				pendingActionId !== null &&
				pendingActionId !== event.request.requestId) ||
			(!hasPendingApproval && pendingActionId === null);
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

function App() {
	const [workspacePath, setWorkspacePath] = useState<string>("");
	const [mode, setMode] = useState<DesktopPermissionMode>("ask_first");
	const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
	const [composerValue, setComposerValue] = useState("");
	const [events, setEvents] = useState<TimelineEvent[]>([
		{
			id: crypto.randomUUID(),
			type: "assistant",
			markdown:
				"## NOOA Desktop\nChoose a workspace on the left, then ask me to inspect, write, or delete files inside it.",
		},
	]);
	const [pendingApproval, setPendingApproval] =
		useState<DesktopActionRequest | null>(null);
	const [pendingActionId, setPendingActionId] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);

	async function chooseWorkspace() {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Choose a workspace for NOOA Desktop",
		});
		if (typeof selected !== "string") {
			return;
		}

		setWorkspacePath(selected);
		setSessionId(crypto.randomUUID());
		setPendingApproval(null);
		setPendingActionId(null);
		setEvents([
			{
				id: crypto.randomUUID(),
				type: "assistant",
				markdown: `Workspace locked to \`${selected}\`.\n\nAsk me to inspect, create, edit, or remove files inside this folder.`,
			},
		]);
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
	}

	async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const message = composerValue.trim();
		if (!message || !workspacePath || isRunning || pendingApproval) {
			return;
		}

		setIsRunning(true);
		setComposerValue("");
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
	}

	async function resolveApproval(
		request: DesktopActionRequest,
		approved: boolean,
	) {
		if (isRunning || request.requestId !== pendingApproval?.requestId) {
			return;
		}

		setIsRunning(true);
		setPendingActionId(request.requestId);
		try {
			await callBridge({
				type: approved ? "approve" : "deny",
				sessionId,
				workspacePath,
				mode,
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
			setPendingActionId(null);
			setIsRunning(false);
		}
	}

	return (
		<main className="app-shell">
			<aside className="sidebar glass-panel">
				<div className="brand-block">
					<span className="brand-kicker">LOCAL AGENT</span>
					<h1>NOOA Desktop</h1>
					<p>
						Chat-driven coding workspace with file actions rendered as
						first-class events.
					</p>
				</div>

				<section className="sidebar-section">
					<div className="section-head">
						<span>Workspace</span>
						<button
							className="button-secondary"
							onClick={chooseWorkspace}
							type="button"
						>
							Choose folder
						</button>
					</div>
					<div className="workspace-card">
						<span className="status-dot" />
						<div>
							<strong>{workspacePath || "No workspace selected"}</strong>
							<p>
								NOOA stays locked to this folder for reads, writes, and deletes.
							</p>
						</div>
					</div>
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

			<section className="chat-column">
				<header className="chat-header glass-panel">
					<div>
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
							hasPendingApproval={pendingApproval !== null}
							onApprove={(request) => void resolveApproval(request, true)}
							onDeny={(request) => void resolveApproval(request, false)}
							pendingActionId={pendingActionId}
						/>
					))}
				</div>

				<form className="composer glass-panel" onSubmit={handleSendMessage}>
					<textarea
						disabled={!workspacePath || isRunning || Boolean(pendingApproval)}
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
								: "Responses are rendered as polished markdown plus structured file events."}
						</span>
						<button
							disabled={
								!workspacePath ||
								isRunning ||
								Boolean(pendingApproval) ||
								!composerValue.trim()
							}
							type="submit"
						>
							{isRunning ? "Running..." : "Send"}
						</button>
					</div>
				</form>
			</section>
		</main>
	);
}

export default App;
