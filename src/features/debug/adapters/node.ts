import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DebugCdpClient } from "../cdp/client";
import type { DebugBreakpointRef, DebugRuntime } from "../session/types";
import type { DebugExceptionPauseMode } from "../session/types";
import type {
	DebugAdapter,
	DebugAttachInput,
	DebugBreakpointInput,
	DebugEvalInput,
	DebugEvalResult,
	DebugInspectAtInput,
	DebugInspectOnFailureInput,
	DebugStateSnapshot,
	DebugValueSnapshot,
} from "./types";

const INSPECTOR_TIMEOUT_MS = 5000;
const INSPECTOR_POLL_MS = 50;

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function pickOpenPort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Failed to resolve ephemeral port"));
				return;
			}

			const port = address.port;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(port);
			});
		});
		server.on("error", reject);
	});
}

async function discoverInspectorUrl(port: number): Promise<string> {
	const deadline = Date.now() + INSPECTOR_TIMEOUT_MS;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/list`);
			if (response.ok) {
				const payload = (await response.json()) as Array<{
					webSocketDebuggerUrl?: string;
				}>;
				const wsUrl = payload[0]?.webSocketDebuggerUrl;
				if (wsUrl) {
					return wsUrl;
				}
			}
		} catch {}

		await Bun.sleep(INSPECTOR_POLL_MS);
	}

	throw new Error(`Failed to detect Node inspector URL on port ${port}`);
}

export class NodeDebugAdapter implements DebugAdapter {
	private process: ChildProcess | null = null;
	private snapshot: DebugStateSnapshot = {
		runtime: "node",
		state: "idle",
	};

	constructor(private runtime: DebugRuntime = "node") {
		this.snapshot.runtime = runtime;
	}

	async launch(input: {
		command: string[];
		brk?: boolean;
	}): Promise<DebugStateSnapshot> {
		const runtime = input.command[0];
		if (!runtime) {
			throw new Error("Missing runtime command");
		}

		const port = await pickOpenPort();
		const inspectFlag = input.brk
			? `--inspect-brk=127.0.0.1:${port}`
			: `--inspect=127.0.0.1:${port}`;
		const child = spawn(runtime, [inspectFlag, ...input.command.slice(1)], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		this.process = child;

		const wsUrl = await discoverInspectorUrl(port);
		let initialSnapshot: DebugStateSnapshot | null = null;
		if (input.brk) {
			const client = await DebugCdpClient.connect(wsUrl);
			const targetFileUrl = pathToFileURL(
				resolve(input.command.at(-1) ?? "unknown"),
			).toString();
			const scriptUrls = new Map<string, string>();
			client.on("Debugger.scriptParsed", (params) => {
				const parsed = params as { scriptId?: string; url?: string };
				if (parsed.scriptId && parsed.url) {
					scriptUrls.set(parsed.scriptId, parsed.url);
				}
			});
			try {
				await client.send("Debugger.enable");
				await client.send("Runtime.enable");
				let paused = (await this.waitForPausedState(client)) as
					| {
							callFrames?: Array<{
								location?: {
									scriptId?: string;
									lineNumber?: number;
									columnNumber?: number;
								};
								functionName?: string;
								url?: string;
							}>;
						}
					| null;

				for (let skips = 0; paused && skips < 10; skips++) {
					const scriptId = paused.callFrames?.[0]?.location?.scriptId;
					const scriptUrl =
						paused.callFrames?.[0]?.url ||
						(scriptId ? scriptUrls.get(scriptId) : undefined);
					if (scriptUrl === targetFileUrl) {
						break;
					}
					await client.send("Debugger.resume").catch(() => undefined);
					paused = (await client.waitFor("Debugger.paused", 1000).catch(
						() => null,
					)) as typeof paused;
				}

				if (paused) {
					initialSnapshot = this.snapshotFromPausedEvent(paused, scriptUrls);
				}
			} finally {
				client.disconnect();
			}
		}

		this.snapshot = {
			runtime: this.runtime,
			state: input.brk ? "paused" : "running",
			target: {
				command: input.command,
				pid: child.pid ?? undefined,
				wsUrl,
			},
			location: input.brk
				? {
						file: input.command.at(-1) ?? "unknown",
						line: 1,
						column: 1,
					}
				: undefined,
			breakpoints: [],
		};

		if (initialSnapshot) {
			this.snapshot = {
				...this.snapshot,
				...initialSnapshot,
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
			};
		}

		return this.snapshot;
	}

	async attach(input: DebugAttachInput): Promise<DebugStateSnapshot> {
		this.snapshot = {
			...this.snapshot,
			runtime: this.runtime,
			state: input.state ?? "paused",
			target: {
				...this.snapshot.target,
				command: input.command ?? this.snapshot.target?.command ?? ["attach", input.target],
				wsUrl: input.target,
			},
		};

		return this.snapshot;
	}

	async status(): Promise<DebugStateSnapshot> {
		return this.snapshot;
	}

	async stop(): Promise<void> {
		if (this.process?.pid) {
			try {
				process.kill(this.process.pid, "SIGTERM");
			} catch {}
		}
		this.process = null;
		this.snapshot = {
			runtime: this.runtime,
			state: "idle",
		};
	}

	async capture(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot> {
		const runtime = input.command[0];
		if (!runtime) {
			throw new Error("Missing runtime command");
		}

		const port = await pickOpenPort();
		const child = spawn(runtime, [`--inspect-brk=127.0.0.1:${port}`, ...input.command.slice(1)], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		this.process = child;

		const wsUrl = await discoverInspectorUrl(port);
		const client = await DebugCdpClient.connect(wsUrl);
		const targetFileUrl = pathToFileURL(
			resolve(input.command.at(-1) ?? "unknown"),
		).toString();
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});

		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			this.snapshot = {
				runtime: this.runtime,
				state: "paused",
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
				location: {
					file: input.command.at(-1) ?? "unknown",
					line: 1,
					column: 1,
				},
				breakpoints: [],
			};
			let paused = (await this.waitForPausedState(client)) as
				| {
						callFrames?: Array<{
							functionName?: string;
							location?: {
								scriptId?: string;
								lineNumber?: number;
								columnNumber?: number;
							};
							url?: string;
						}>;
					}
				| null;

			for (let skips = 0; paused && skips < 10; skips++) {
				const scriptId = paused.callFrames?.[0]?.location?.scriptId;
				const scriptUrl =
					paused.callFrames?.[0]?.url ||
					(scriptId ? scriptUrls.get(scriptId) : undefined);
				if (scriptUrl === targetFileUrl) {
					break;
				}
				await client.send("Debugger.resume").catch(() => undefined);
				paused = (await client.waitFor("Debugger.paused", 1000).catch(
					() => null,
				)) as typeof paused;
			}

			if (!paused?.callFrames?.[0]) {
				throw new Error("Failed to capture startup pause");
			}

			this.snapshot = {
				...this.snapshotFromPausedEvent(paused, scriptUrls),
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
			};
			return this.snapshot;
		} finally {
			client.disconnect();
		}
	}

	async inspectAt(input: DebugInspectAtInput): Promise<DebugStateSnapshot> {
		const runtime = input.command[0];
		if (!runtime) {
			throw new Error("Missing runtime command");
		}

		const port = await pickOpenPort();
		const child = spawn(runtime, [`--inspect-brk=127.0.0.1:${port}`, ...input.command.slice(1)], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		this.process = child;

		const wsUrl = await discoverInspectorUrl(port);
		const fileUrl = pathToFileURL(resolve(input.target.file)).toString();
		const client = await DebugCdpClient.connect(wsUrl);
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});

		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const breakpointResult = (await client.send("Debugger.setBreakpointByUrl", {
				lineNumber: input.target.line - 1,
				...(input.target.column ? { columnNumber: input.target.column - 1 } : {}),
				urlRegex: `${escapeRegex(fileUrl)}$`,
			})) as { breakpointId: string };

			this.snapshot = {
				runtime: this.runtime,
				state: "paused",
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
				location: {
					file: input.command.at(-1) ?? "unknown",
					line: 1,
					column: 1,
				},
				breakpoints: [
					{
						ref: breakpointResult.breakpointId,
						file: input.target.file,
						line: input.target.line,
						column: input.target.column,
						remoteId: breakpointResult.breakpointId,
					},
				],
			};

			await client.send("Runtime.runIfWaitingForDebugger").catch(() => undefined);
			for (let attempt = 0; attempt < 4; attempt++) {
				const pausedWaiter = client.waitFor("Debugger.paused", 1500).catch(
					() => null,
				);
				await client.send("Debugger.resume").catch(() => undefined);
				const paused = (await pausedWaiter) as
					| {
							reason?: string;
							hitBreakpoints?: string[];
							callFrames?: Array<{
								functionName?: string;
								location?: {
									scriptId?: string;
									lineNumber?: number;
									columnNumber?: number;
								};
								url?: string;
							}>;
						}
					| null;
				if (!paused?.callFrames?.[0]) {
					break;
				}

				const nextSnapshot = this.snapshotFromPausedEvent(paused, scriptUrls);
				const hitTarget = (paused.hitBreakpoints ?? []).includes(
					breakpointResult.breakpointId,
				);
				const startupPause =
					paused.reason === "Break on start" &&
					(paused.hitBreakpoints ?? []).length === 0;
				if (startupPause && !hitTarget) {
					continue;
				}

				this.snapshot = {
					...nextSnapshot,
					target: {
						command: input.command,
						pid: child.pid ?? undefined,
						wsUrl,
					},
					breakpoints: [
						{
							ref: breakpointResult.breakpointId,
							file: input.target.file,
							line: input.target.line,
							column: input.target.column,
							remoteId: breakpointResult.breakpointId,
						},
					],
				};
				return this.snapshot;
			}

			this.snapshot = {
				...this.snapshot,
				state: "running",
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
			};
			return this.snapshot;
		} finally {
			client.disconnect();
		}
	}

	async inspectOnFailure(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot> {
		const runtime = input.command[0];
		if (!runtime) {
			throw new Error("Missing runtime command");
		}

		const port = await pickOpenPort();
		const child = spawn(runtime, [`--inspect-brk=127.0.0.1:${port}`, ...input.command.slice(1)], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		this.process = child;

		const wsUrl = await discoverInspectorUrl(port);
		const client = await DebugCdpClient.connect(wsUrl);
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});

		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			await client.send("Debugger.setPauseOnExceptions", {
				state: "uncaught",
			});

			this.snapshot = {
				runtime: this.runtime,
				state: "paused",
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
				location: {
					file: input.command.at(-1) ?? "unknown",
					line: 1,
					column: 1,
				},
				breakpoints: [],
			};

			await client.send("Runtime.runIfWaitingForDebugger").catch(() => undefined);
			for (let attempt = 0; attempt < 4; attempt++) {
				const pausedWaiter = client.waitFor("Debugger.paused", 1500).catch(
					() => null,
				);
				await client.send("Debugger.resume").catch(() => undefined);
				const paused = (await pausedWaiter) as
					| {
							reason?: string;
							data?: {
								type?: string;
								description?: string;
								value?: unknown;
							};
							callFrames?: Array<{
								functionName?: string;
								location?: {
									scriptId?: string;
									lineNumber?: number;
									columnNumber?: number;
								};
								url?: string;
							}>;
						}
					| null;
				if (!paused?.callFrames?.[0]) {
					break;
				}

				const startupPause =
					paused.reason === "Break on start";
				if (startupPause) {
					continue;
				}

				this.snapshot = {
					...this.snapshotFromPausedEvent(paused, scriptUrls),
					target: {
						command: input.command,
						pid: child.pid ?? undefined,
						wsUrl,
					},
					exception: this.exceptionFromPausedEvent(paused),
				};
				return this.snapshot;
			}

			this.snapshot = {
				...this.snapshot,
				state: "running",
				target: {
					command: input.command,
					pid: child.pid ?? undefined,
					wsUrl,
				},
			};
			return this.snapshot;
		} finally {
			client.disconnect();
		}
	}

	async runTo(input: DebugBreakpointInput): Promise<DebugStateSnapshot> {
		if (!this.snapshot.target?.wsUrl || !this.snapshot.target.command?.length) {
			throw new Error("No active debug target");
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});
		let breakpointId: string | undefined;
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const fileUrl =
				input.file.startsWith("file://")
					? input.file
					: pathToFileURL(resolve(input.file)).toString();
			const result = (await client.send("Debugger.setBreakpointByUrl", {
				lineNumber: input.line - 1,
				...(input.column ? { columnNumber: input.column - 1 } : {}),
				urlRegex: `${escapeRegex(fileUrl)}$`,
			})) as { breakpointId: string };
			breakpointId = result.breakpointId;
			await client.send("Runtime.runIfWaitingForDebugger").catch(() => undefined);

			for (let attempt = 0; attempt < 4; attempt++) {
				const pausedWaiter = client.waitFor("Debugger.paused", 1500).catch(
					() => null,
				);
				await client.send("Debugger.resume").catch(() => undefined);
				const paused = (await pausedWaiter) as
					| {
							reason?: string;
							hitBreakpoints?: string[];
							callFrames?: Array<{
								callFrameId?: string;
								functionName?: string;
								location?: {
									scriptId?: string;
									lineNumber?: number;
									columnNumber?: number;
								};
								url?: string;
							}>;
						}
					| null;
				if (!paused?.callFrames?.[0]) {
					break;
				}

				const nextSnapshot = this.snapshotFromPausedEvent(paused, scriptUrls);
				const hitTarget = (paused.hitBreakpoints ?? []).includes(result.breakpointId);
				if (!hitTarget) {
					continue;
				}

				this.snapshot = {
					...nextSnapshot,
					target: this.snapshot.target,
				};
				return this.snapshot;
			}

			this.snapshot = {
				...this.snapshot,
				state: "running",
			};
			return this.snapshot;
		} finally {
			if (breakpointId) {
				await client
					.send("Debugger.removeBreakpoint", { breakpointId })
					.catch(() => undefined);
			}
			client.disconnect();
		}
	}

	async setBreakpoint(
		input: DebugBreakpointInput,
	): Promise<DebugBreakpointRef> {
		if (!this.snapshot.target?.wsUrl) {
			throw new Error("No active debug target");
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const fileUrl =
				input.file.startsWith("file://")
					? input.file
					: pathToFileURL(resolve(input.file)).toString();
			await this.waitForPausedState(client).catch(() => null);
			const directScriptId = [...scriptUrls.entries()].find(
				([, url]) => url === fileUrl,
			)?.[0];
			const result =
				directScriptId
					? ((await client.send("Debugger.setBreakpoint", {
							location: {
								scriptId: directScriptId,
								lineNumber: input.line - 1,
								...(input.column ? { columnNumber: input.column - 1 } : {}),
							},
							...(input.message
								? {
										condition: `console.log(${JSON.stringify(input.message)}), false`,
									}
								: {}),
						})) as {
							breakpointId: string;
						})
					: ((await client.send("Debugger.setBreakpointByUrl", {
							lineNumber: input.line - 1,
							...(input.column ? { columnNumber: input.column - 1 } : {}),
							urlRegex: `${escapeRegex(fileUrl)}$`,
							...(input.message
								? {
										condition: `console.log(${JSON.stringify(input.message)}), false`,
									}
								: {}),
						})) as {
							breakpointId: string;
						});

			const breakpoint: DebugBreakpointRef = {
				ref: result.breakpointId,
				file: input.file,
				line: input.line,
				column: input.column,
				remoteId: result.breakpointId,
				kind: input.message ? "logpoint" : "breakpoint",
				message: input.message,
			};
			this.snapshot = {
				...this.snapshot,
				breakpoints: [...(this.snapshot.breakpoints ?? []), breakpoint],
			};
			return breakpoint;
		} finally {
			client.disconnect();
		}
	}

	async listBreakpoints(): Promise<DebugBreakpointRef[]> {
		return [...(this.snapshot.breakpoints ?? [])];
	}

	async removeBreakpoint(ref: string): Promise<void> {
		if (!this.snapshot.target?.wsUrl) {
			return;
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Debugger.removeBreakpoint", { breakpointId: ref });
			this.snapshot = {
				...this.snapshot,
				breakpoints: (this.snapshot.breakpoints ?? []).filter(
					(bp) => bp.remoteId !== ref && bp.ref !== ref,
				),
			};
		} finally {
			client.disconnect();
		}
	}

	async continue(): Promise<DebugStateSnapshot> {
		if (this.snapshot.target?.wsUrl) {
			const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
			try {
				await client.send("Debugger.enable");
				await client.send("Runtime.enable");
				await client.send("Runtime.runIfWaitingForDebugger").catch(() => undefined);
				for (let attempt = 0; attempt < 4; attempt++) {
					const pausedWaiter = client.waitFor("Debugger.paused", 1500).catch(
						() => null,
					);
					await client.send("Debugger.resume").catch(() => undefined);
					const paused = (await pausedWaiter) as
						| {
								reason?: string;
								callFrames?: Array<{
									functionName?: string;
									location?: { lineNumber?: number; columnNumber?: number };
									url?: string;
								}>;
							}
						| null;
					if (!paused?.callFrames?.[0]) {
						break;
					}

					const nextSnapshot = this.snapshotFromPausedEvent(paused);
					const isStartupPause =
						paused.reason === "Break on start" ||
						(nextSnapshot.location?.file === this.snapshot.location?.file &&
							nextSnapshot.location?.line === this.snapshot.location?.line);
					if (isStartupPause) {
						continue;
					}

					this.snapshot = nextSnapshot;
					return this.snapshot;
				}
			} finally {
				client.disconnect();
			}
		}

		this.snapshot = {
			...this.snapshot,
			state: "running",
			location: undefined,
		};
		return this.snapshot;
	}

	async step(mode: "over" | "into" | "out"): Promise<DebugStateSnapshot> {
		if (!this.snapshot.target?.wsUrl) {
			throw new Error("No active debug target");
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		const scriptUrls = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const parsed = params as { scriptId?: string; url?: string };
			if (parsed.scriptId && parsed.url) {
				scriptUrls.set(parsed.scriptId, parsed.url);
			}
		});
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			await this.waitForPausedState(client).catch(() => null);
			let latestSnapshot = this.snapshot;

			for (let attempt = 0; attempt < 6; attempt++) {
				const pausedWaiter = client.waitFor("Debugger.paused", 1000).catch(() => null);
				if (mode === "into") {
					await client.send("Debugger.stepInto");
				} else if (mode === "out") {
					await client.send("Debugger.stepOut");
				} else {
					await client.send("Debugger.stepOver");
				}
				const paused = (await pausedWaiter) as
					| {
							callFrames?: Array<{
								callFrameId?: string;
								functionName?: string;
								location?: {
									scriptId?: string;
									lineNumber?: number;
									columnNumber?: number;
								};
								url?: string;
							}>;
						}
					| null;

				if (!paused?.callFrames?.[0]) {
					return latestSnapshot;
				}

				latestSnapshot = this.snapshotFromPausedEvent(paused, scriptUrls);
				this.snapshot = latestSnapshot;
				if (!this.isInternalDebugLocation(latestSnapshot.location?.file)) {
					return latestSnapshot;
				}
			}

			return latestSnapshot;
		} finally {
			client.disconnect();
		}
	}

	async pause(): Promise<DebugStateSnapshot> {
		if (!this.snapshot.target?.wsUrl) {
			throw new Error("No active debug target");
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			await client.send("Debugger.pause").catch(() => undefined);
			const paused = (await client.waitFor("Debugger.paused", 1000).catch(
				() => null,
			)) as
				| {
						callFrames?: Array<{
							callFrameId?: string;
							functionName?: string;
							location?: { scriptId?: string; lineNumber?: number; columnNumber?: number };
							url?: string;
						}>;
					}
				| null;
			if (!paused?.callFrames?.[0]) {
				return this.snapshot;
			}

			this.snapshot = this.snapshotFromPausedEvent(paused);
			return this.snapshot;
		} finally {
			client.disconnect();
		}
	}

	async buildState(): Promise<DebugStateSnapshot> {
		if (!this.snapshot.target?.wsUrl || this.snapshot.state !== "paused") {
			return this.snapshot;
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const paused = (await this.waitForPausedState(client)) as
				| {
						callFrames?: Array<{
							functionName?: string;
							location?: { scriptId?: string; lineNumber?: number; columnNumber?: number };
							url?: string;
						}>;
					}
				| null;

			const firstFrame = paused?.callFrames?.[0];
			if (!firstFrame) {
				return this.snapshot;
			}

			return this.snapshotFromPausedEvent(paused);
		} finally {
			client.disconnect();
		}
	}

	async getVars(): Promise<DebugValueSnapshot[]> {
		if (!this.snapshot.target?.wsUrl || this.snapshot.state !== "paused") {
			return [];
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const paused = (await this.waitForPausedState(client)) as
				| {
						callFrames?: Array<{
							scopeChain?: Array<{
								type?: string;
								object?: { objectId?: string };
							}>;
						}>;
					}
				| null;

			const firstFrame = paused?.callFrames?.[0];
			const scopeChain = firstFrame?.scopeChain ?? [];
			const localScope = scopeChain.find((scope) => scope.type === "local");
			const objectId = localScope?.object?.objectId;
			if (!objectId) {
				return [];
			}

			const props = (await client.send("Runtime.getProperties", {
				objectId,
				ownProperties: true,
				generatePreview: true,
			})) as {
				result?: Array<{
					name?: string;
					value?: {
						type?: string;
						value?: unknown;
						description?: string;
						objectId?: string;
					};
				}>;
			};

			return (props.result ?? [])
				.filter((prop) => prop.name && prop.value)
				.map((prop, index) => ({
					ref: `@v${index + 1}`,
					name: String(prop.name),
					id: prop.value?.objectId,
					value:
						prop.value?.description ??
						(typeof prop.value?.value === "string"
							? JSON.stringify(prop.value.value)
							: String(prop.value?.value)),
					scope: "local",
				}));
		} finally {
			client.disconnect();
		}
	}

	async getProperties(objectId: string): Promise<DebugValueSnapshot[]> {
		if (!this.snapshot.target?.wsUrl) {
			return [];
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const props = (await client.send("Runtime.getProperties", {
				objectId,
				ownProperties: true,
				generatePreview: true,
			})) as {
				result?: Array<{
					name?: string;
					value?: {
						type?: string;
						value?: unknown;
						description?: string;
						objectId?: string;
					};
				}>;
			};

			return (props.result ?? [])
				.filter((prop) => prop.name && prop.value)
				.map((prop, index) => ({
					ref: `@v${index + 1}`,
					name: String(prop.name),
					id: prop.value?.objectId,
					value:
						prop.value?.description ??
						(typeof prop.value?.value === "string"
							? JSON.stringify(prop.value.value)
							: String(prop.value?.value)),
					scope: "property",
				}));
		} finally {
			client.disconnect();
		}
	}

	async getPropertiesFromExpression(expression: string): Promise<DebugValueSnapshot[]> {
		if (!this.snapshot.target?.wsUrl) {
			return [];
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const paused = (await this.waitForPausedState(client)) as
				| {
						callFrames?: Array<{
							callFrameId?: string;
						}>;
					}
				| null;

			const callFrameId = paused?.callFrames?.[0]?.callFrameId;
			const evaluation = callFrameId
				? ((await client.send("Debugger.evaluateOnCallFrame", {
						callFrameId,
						expression,
						returnByValue: false,
						generatePreview: true,
					})) as {
						result?: { objectId?: string };
					})
				: ((await client.send("Runtime.evaluate", {
						expression,
						returnByValue: false,
						generatePreview: true,
					})) as {
						result?: { objectId?: string };
					});

			const objectId = evaluation.result?.objectId;
			if (!objectId) {
				return [];
			}

			const props = (await client.send("Runtime.getProperties", {
				objectId,
				ownProperties: true,
				generatePreview: true,
			})) as {
				result?: Array<{
					name?: string;
					value?: {
						type?: string;
						value?: unknown;
						description?: string;
						objectId?: string;
					};
				}>;
			};

			return (props.result ?? [])
				.filter((prop) => prop.name && prop.value)
				.map((prop, index) => ({
					ref: `@v${index + 1}`,
					name: String(prop.name),
					id: prop.value?.objectId,
					value:
						prop.value?.description ??
						(typeof prop.value?.value === "string"
							? JSON.stringify(prop.value.value)
							: String(prop.value?.value)),
					scope: "property",
				}));
		} finally {
			client.disconnect();
		}
	}

	async getConsole() {
		if (!this.snapshot.target?.wsUrl) {
			return [];
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		const entries: Array<{ level: string; text: string }> = [];
		client.on("Runtime.consoleAPICalled", (params) => {
			const payload = params as {
				type?: string;
				args?: Array<{ value?: unknown; description?: string }>;
			};
			const text = (payload.args ?? [])
				.map((arg) =>
					arg.description ??
					(typeof arg.value === "string" ? arg.value : arg.value !== undefined ? String(arg.value) : ""),
				)
				.filter(Boolean)
				.join(" ")
				.trim();
			if (!text) {
				return;
			}
			entries.push({
				level: payload.type ?? "log",
				text,
			});
		});

		try {
			await client.send("Runtime.enable");
			await Bun.sleep(250);
			return entries;
		} finally {
			client.disconnect();
		}
	}

	async getScripts() {
		if (!this.snapshot.target?.wsUrl) {
			return [];
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		const scripts = new Map<string, string>();
		client.on("Debugger.scriptParsed", (params) => {
			const payload = params as { scriptId?: string; url?: string };
			if (!payload.url) {
				return;
			}
			scripts.set(payload.scriptId ?? payload.url, payload.url);
		});

		try {
			await client.send("Debugger.enable");
			await Bun.sleep(150);
			const collected = [...scripts.entries()].map(([id, url]) => ({ id, url }));
			const targetFile = this.snapshot.target.command.at(-1);
			if (targetFile) {
				const targetUrl = pathToFileURL(resolve(targetFile)).toString();
				if (!collected.some((script) => script.url === targetUrl)) {
					collected.unshift({
						id: "target",
						url: targetUrl,
					});
				}
			}
			return collected;
		} finally {
			client.disconnect();
		}
	}

	async setExceptionPauseMode(mode: DebugExceptionPauseMode) {
		if (!this.snapshot.target?.wsUrl) {
			return;
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Debugger.setPauseOnExceptions", {
				state: mode,
			});
		} finally {
			client.disconnect();
		}
	}

	async evaluate(_input: DebugEvalInput): Promise<DebugEvalResult> {
		if (!this.snapshot.target?.wsUrl) {
			throw new Error("No active debug target");
		}

		const client = await DebugCdpClient.connect(this.snapshot.target.wsUrl);
		try {
			await client.send("Debugger.enable");
			await client.send("Runtime.enable");
			const paused = (await this.waitForPausedState(client)) as
				| {
						callFrames?: Array<{
							callFrameId?: string;
						}>;
					}
				| null;

			const callFrameId = paused?.callFrames?.[0]?.callFrameId;
			if (callFrameId) {
				const result = (await client.send("Debugger.evaluateOnCallFrame", {
					callFrameId,
					expression: _input.expression,
					returnByValue: false,
					generatePreview: true,
				})) as {
					result?: { value?: unknown; description?: string; objectId?: string };
				};

				return {
					ref: "@v1",
					id: result.result?.objectId,
					value:
						result.result?.description ??
						(typeof result.result?.value === "string"
							? JSON.stringify(result.result.value)
							: String(result.result?.value)),
				};
			}

			const result = (await client.send("Runtime.evaluate", {
				expression: _input.expression,
				returnByValue: false,
				generatePreview: true,
			})) as {
				result?: { value?: unknown; description?: string; objectId?: string };
			};

			return {
				ref: "@v1",
				id: result.result?.objectId,
				value:
					result.result?.description ??
					(typeof result.result?.value === "string"
						? JSON.stringify(result.result.value)
						: String(result.result?.value)),
			};
		} finally {
			client.disconnect();
		}
	}

	private async waitForPausedState(client: DebugCdpClient): Promise<unknown | null> {
		const paused = await client.waitFor("Debugger.paused", 100).catch(() => null);
		if (paused) {
			return paused;
		}

		if (this.snapshot.state !== "paused") {
			return null;
		}

		await client.send("Debugger.pause").catch(() => undefined);
		await client.send("Runtime.runIfWaitingForDebugger").catch(() => undefined);
		return await client.waitFor("Debugger.paused", 1000).catch(() => null);
	}

	private snapshotFromPausedEvent(
		paused: {
		callFrames?: Array<{
			callFrameId?: string;
			functionName?: string;
			location?: { scriptId?: string; lineNumber?: number; columnNumber?: number };
			url?: string;
		}>;
		},
		scriptUrls?: Map<string, string>,
	): DebugStateSnapshot {
		const frames = paused.callFrames ?? [];
		const firstFrame =
			frames.find((frame) => {
				const frameUrl =
					frame.url ||
					(frame.location?.scriptId ? scriptUrls?.get(frame.location.scriptId) : undefined);
				return Boolean(frameUrl) && !String(frameUrl).startsWith("node:internal");
			}) ?? frames[0];
		const file =
			firstFrame?.url ||
			(firstFrame?.location?.scriptId
				? scriptUrls?.get(firstFrame.location.scriptId)
				: undefined) ||
			this.snapshot.location?.file ||
			this.snapshot.target?.command.at(-1) ||
			"unknown";
		const line = (firstFrame?.location?.lineNumber ?? 0) + 1;
		const column = (firstFrame?.location?.columnNumber ?? 0) + 1;
		const source = this.readSourceSnippet(file, line);

		return {
			...this.snapshot,
			state: "paused",
			location: { file, line, column },
			source,
			stack: [
				{
					ref: "@f0",
					id: firstFrame?.callFrameId,
					name: firstFrame?.functionName || "(anonymous)",
					file,
					line,
					column,
				},
			],
		};
	}

	private readSourceSnippet(file: string, line: number): string[] | undefined {
		try {
			const path = file.startsWith("file://") ? fileURLToPath(file) : file;
			const lines = readFileSync(path, "utf8").split("\n");
			const start = Math.max(0, line - 3);
			const end = Math.min(lines.length, line + 2);
			return lines.slice(start, end);
		} catch {
			return undefined;
		}
	}

	private isInternalDebugLocation(file: string | undefined): boolean {
		return Boolean(file) && String(file).startsWith("node:internal");
	}

	private exceptionFromPausedEvent(paused: {
		reason?: string;
		data?: { type?: string; description?: string; value?: unknown };
	}): { reason: string; message?: string } | undefined {
		if (paused.reason !== "exception") {
			return undefined;
		}

		const message =
			paused.data?.description ??
			(typeof paused.data?.value === "string"
				? paused.data.value
				: paused.data?.value !== undefined
					? String(paused.data.value)
					: undefined);

		return {
			reason: paused.reason,
			message,
		};
	}
}

export function createNodeDebugAdapter(
	runtime: DebugRuntime = "node",
): DebugAdapter {
	return new NodeDebugAdapter(runtime);
}
