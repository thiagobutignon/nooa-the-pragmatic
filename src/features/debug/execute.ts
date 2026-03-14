import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execa } from "execa";
import type { SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { createNodeDebugAdapter } from "./adapters/node";
import type {
	DebugAdapter,
	DebugConsoleEntry,
	DebugFrameSnapshot,
	DebugStateSnapshot,
	DebugValueSnapshot,
} from "./adapters/types";
import { assignBreakpointRefs, assignFrameRefs } from "./refs";
import {
	createDebugSession,
	deleteDebugSession,
	loadDebugSession,
	saveDebugSession,
} from "./session/store";
import type { DebugBreakpointRef, DebugRuntime } from "./session/types";
import type { DebugExceptionPauseMode } from "./session/types";
import type { DebugSessionRecord } from "./session/store";

export interface RunDebugInput {
	action?: string;
	command?: string[];
	brk?: boolean;
	target?: string;
	expression?: string;
	cwd?: string;
	session?: string;
}

export interface RunDebugResult {
	mode: string;
	session?: string;
	runtime?: string;
	state?: string;
	source?: string[];
	console?: DebugConsoleEntry[];
	vars?: DebugValueSnapshot[];
	stack?: DebugFrameSnapshot[];
	breakpoints?: DebugBreakpointRef[];
	exception?: {
		reason: string;
		message?: string;
	};
	result?: { ref: string; value: string };
	scripts?: Array<{ id?: string; url: string }>;
	target?: {
		command: string[];
		pid?: number;
		wsUrl?: string;
	};
	raw?: string;
}

type DebugCommandFailureResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

async function buildStoredState(
	root: string,
	session: NonNullable<Awaited<ReturnType<typeof loadDebugSession>>>,
): Promise<RunDebugResult> {
	let source: string[] | undefined;
	if (session.location?.file) {
		const candidates = session.location.file.startsWith("/")
			? [session.location.file]
			: [resolve(root, session.location.file), resolve(process.cwd(), session.location.file)];
		for (const candidate of candidates) {
			try {
				const raw = await readFile(candidate, "utf-8");
				source = raw.split("\n").slice(0, 5);
				break;
			} catch {}
		}
	}

	const stack = session.location
		? assignFrameRefs([
				{
					name: "(anonymous)",
					file: session.location.file,
					line: session.location.line,
					column: session.location.column,
				},
			])
		: undefined;

	return {
		mode: "state",
		session: session.name,
		runtime: session.runtime,
		state: session.state,
		target: session.target,
		source,
		console: session.console,
		raw: session.exceptionPauseMode
			? `Exception pause mode: ${session.exceptionPauseMode}`
			: undefined,
		stack,
		vars: [],
	};
}

async function hydrateAdapterFromSession(
	adapter: DebugAdapter,
	session: NonNullable<Awaited<ReturnType<typeof loadDebugSession>>>,
): Promise<void> {
	const attachTarget =
		session.target?.wsUrl ??
		(session.target?.pid ? String(session.target.pid) : null);
	if (!attachTarget) {
		return;
	}

	try {
		await adapter.attach({
			target: attachTarget,
			command: session.target.command,
			state: session.state,
		});
	} catch {}
}

function publicBreakpoints(
	breakpoints: DebugBreakpointRef[] | undefined,
): DebugBreakpointRef[] | undefined {
	if (!breakpoints) {
		return undefined;
	}

	const generatedRefs = assignBreakpointRefs(
		breakpoints.map(({ file, line, column, remoteId }) => ({
			file,
			line,
			column,
			remoteId,
		})),
	);

	return breakpoints.map(({ ref, file, line, column, kind, message }, index) => ({
		ref: ref.startsWith("BP#") ? ref : generatedRefs[index]?.ref ?? `BP#${index + 1}`,
		file,
		line,
		column,
		kind,
		message,
	}));
}

function firstUsefulSource(
	...candidates: Array<string[] | undefined>
): string[] | undefined {
	return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0);
}

function withSnapshotRefs(
	session: DebugSessionRecord,
	snapshot: Pick<DebugStateSnapshot, "stack" | "vars"> | null | undefined,
): DebugSessionRecord {
	if (!snapshot) {
		return session;
	}

	return {
		...session,
		refs: {
			...session.refs,
			frames:
				snapshot.stack?.map((frame) => ({
					ref: frame.ref,
					id: frame.id,
					name: frame.name,
				})) ?? session.refs.frames,
			values:
				snapshot.vars?.map((value) => ({
					ref: value.ref,
					id: value.id,
					name: value.name,
				})) ?? session.refs.values,
		},
	};
}

function withSessionSnapshot(
	session: DebugSessionRecord,
	snapshot: DebugStateSnapshot | null | undefined,
): DebugSessionRecord {
	if (!snapshot) {
		return session;
	}

	return withSnapshotRefs(
		{
			...session,
			state: snapshot.state,
			location: snapshot.location ?? session.location,
			exception: snapshot.exception ?? session.exception,
			console: snapshot.console ?? session.console,
		},
		snapshot,
	);
}

function withResultRef(
	session: DebugSessionRecord,
	result: { ref: string; id?: string },
	name?: string,
): DebugSessionRecord {
	const nextValues = session.refs.values.filter((value) => value.ref !== result.ref);
	nextValues.unshift({
		ref: result.ref,
		id: result.id,
		name,
	});
	return {
		...session,
		refs: {
			...session.refs,
			values: nextValues,
		},
	};
}

function detectRuntime(command: string[] | undefined): DebugRuntime | null {
	const bin = command?.[0];
	if (bin === "node") return "node";
	if (bin === "bun") return "bun";
	return null;
}

function parseExceptionPauseMode(
	target: string | undefined,
): DebugExceptionPauseMode | null {
	if (target === "none" || target === "uncaught" || target === "all") {
		return target;
	}
	return null;
}

function defaultAdapterFactory(runtime: DebugRuntime): DebugAdapter {
	return createNodeDebugAdapter(runtime);
}

function parseBreakpointTarget(
	target: string | undefined,
): { file: string; line: number; column?: number } | null {
	if (!target) return null;
	const match = target.match(/^(.*):(\d+)(?::(\d+))?$/);
	if (!match) return null;

	const line = Number(match[2]);
	const column = match[3] ? Number(match[3]) : undefined;
	if (!line || Number.isNaN(line)) return null;

	return {
		file: match[1] ?? "",
		line,
		column,
	};
}

async function defaultCommandRunner(
	command: string[],
	cwd: string,
): Promise<DebugCommandFailureResult> {
	const [file, ...args] = command;
	if (!file) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: "Missing command",
		};
	}

	const result = await execa(file, args, {
		cwd,
		reject: false,
		env: {
			...process.env,
			NOOA_DISABLE_REFLECTION: "1",
		},
	});

	return {
		exitCode: result.exitCode ?? 1,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

function parseFailureLocation(output: string): {
	file: string;
	line: number;
	column?: number;
} | null {
	const parenMatch = output.match(/\(([^()\n]+):(\d+):(\d+)\)/);
	if (parenMatch) {
		return {
			file: parenMatch[1] ?? "",
			line: Number(parenMatch[2]),
			column: Number(parenMatch[3]),
		};
	}

	const plainMatch = output.match(/(?:^|\n)(\/[^\s:()]+):(\d+):(\d+)/);
	if (plainMatch) {
		return {
			file: plainMatch[1] ?? "",
			line: Number(plainMatch[2]),
			column: Number(plainMatch[3]),
		};
	}

	return null;
}

async function readFailureSource(
	file: string | undefined,
	line: number | undefined,
): Promise<string[] | undefined> {
	if (!file || !line) {
		return undefined;
	}

	try {
		const raw = await readFile(file, "utf-8");
		const lines = raw.split("\n");
		const start = Math.max(0, line - 3);
		const end = Math.min(lines.length, line + 2);
		return lines.slice(start, end);
	} catch {
		return undefined;
	}
}

function summarizeFailure(output: string): string {
	const lines = output
		.split("\n")
		.map((line) => line.trimEnd())
		.filter(Boolean);
	const errorIndex = lines.findIndex((line) => line.startsWith("error:"));
	if (errorIndex >= 0) {
		return lines.slice(errorIndex, errorIndex + 3).join("\n");
	}
	return lines.slice(0, 3).join("\n");
}

export async function runDebug(
	input: RunDebugInput,
	adapterFactory: (runtime: DebugRuntime) => DebugAdapter = defaultAdapterFactory,
	commandRunner: (
		command: string[],
		cwd: string,
	) => Promise<DebugCommandFailureResult> = defaultCommandRunner,
): Promise<SdkResult<RunDebugResult>> {
	const root = input.cwd ?? process.env.NOOA_CWD ?? process.cwd();
	const sessionName = input.session ?? "default";

	switch (input.action) {
		case "launch": {
			const runtime = detectRuntime(input.command);
			if (!runtime || !input.command?.length) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_target",
						"Unsupported or missing runtime command.",
					),
				};
			}

			const adapter = adapterFactory(runtime);
			try {
				const snapshot = await adapter.launch({
					command: input.command,
					brk: input.brk,
				});
				const session = await createDebugSession(root, {
					name: sessionName,
					runtime,
				});
				await saveDebugSession(root, {
					...session,
					state: snapshot.state,
					target: snapshot.target,
					location: snapshot.location,
					exception: snapshot.exception,
					console: snapshot.console,
				});
				return {
					ok: true,
					data: {
						mode: "launch",
						session: sessionName,
						runtime,
						state: snapshot.state,
						target: snapshot.target,
					},
				};
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"debug.launch_failed",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "inspect-at": {
			const runtime = detectRuntime(input.command);
			const parsed = parseBreakpointTarget(input.target);
			if (!runtime || !input.command?.length) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_target",
						"Unsupported or missing runtime command.",
					),
				};
			}
			if (!parsed) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_breakpoint",
						"Invalid breakpoint target.",
					),
				};
			}

			const adapter = adapterFactory(runtime);
			try {
				const state = await adapter.inspectAt({
					command: input.command,
					target: parsed,
				});
				await adapter.stop();

				return {
					ok: true,
					data: {
						mode: "inspect-at",
						runtime,
						state: state.state,
						source: state.source,
						console: state.console,
						vars: state.vars,
						stack: state.stack,
						breakpoints: publicBreakpoints(state.breakpoints),
					},
				};
			} catch (error) {
				try {
					await adapter.stop();
				} catch {}
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "capture": {
			const runtime = detectRuntime(input.command);
			if (!runtime || !input.command?.length) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_target",
						"Unsupported or missing runtime command.",
					),
				};
			}

			const adapter = adapterFactory(runtime);
			try {
				const state = await adapter.capture({
					command: input.command,
				});
				await adapter.stop();

				return {
					ok: true,
					data: {
						mode: "capture",
						runtime,
						state: state.state,
						source: state.source,
						console: state.console,
						vars: state.vars,
						stack: state.stack,
						breakpoints: publicBreakpoints(state.breakpoints),
					},
				};
			} catch (error) {
				try {
					await adapter.stop();
				} catch {}
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "inspect-on-failure": {
			const runtime = detectRuntime(input.command);
			if (!runtime || !input.command?.length) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_target",
						"Unsupported or missing runtime command.",
					),
				};
			}

			const adapter = adapterFactory(runtime);
			try {
				const state = await adapter.inspectOnFailure({
					command: input.command,
				});
				await adapter.stop();

				return {
					ok: true,
					data: {
						mode: "inspect-on-failure",
						runtime,
						state: state.state,
						source: state.source,
						console: state.console,
						vars: state.vars,
						stack: state.stack,
						breakpoints: publicBreakpoints(state.breakpoints),
						exception: state.exception,
					},
				};
			} catch (error) {
				try {
					await adapter.stop();
				} catch {}
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "inspect-test-failure": {
			if (!input.command?.length) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_target",
						"Unsupported or missing runtime command.",
					),
				};
			}

			const failure = await commandRunner(input.command, root);
			if (failure.exitCode === 0) {
				return {
					ok: true,
					data: {
						mode: "inspect-test-failure",
						state: "passed",
					},
				};
			}

			const combinedOutput = [failure.stderr, failure.stdout]
				.filter(Boolean)
				.join("\n");
			const location = parseFailureLocation(combinedOutput);
			const source = await readFailureSource(location?.file, location?.line);
			const summary = summarizeFailure(combinedOutput);

			return {
				ok: true,
				data: {
					mode: "inspect-test-failure",
					state: "failed",
					source,
					stack: location
						? assignFrameRefs([
								{
									name: "(test failure)",
									file: location.file,
									line: location.line,
									column: location.column,
								},
							])
						: undefined,
					exception: {
						reason: "test_failure",
						message: summary,
					},
				},
			};
		}

		case "status": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}
			return {
				ok: true,
				data: {
					mode: "status",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
				},
			};
		}

		case "state":
		case "vars":
		case "stack": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let snapshot: DebugStateSnapshot | null = null;
			if (input.action !== "vars") {
				try {
					snapshot = await adapter.buildState();
				} catch {}
			}
			if (input.action === "vars") {
				try {
					const vars = await adapter.getVars();
					if (snapshot) {
						snapshot.vars = vars;
					} else {
						snapshot = {
							runtime: session.runtime,
							state: session.state,
							target: session.target,
							vars,
						};
					}
				} catch {}
			}

			const hasUsefulAdapterState =
				snapshot &&
				(snapshot.state === "paused" ||
					(snapshot.vars && snapshot.vars.length > 0) ||
					(snapshot.stack && snapshot.stack.length > 0));

			const stored = await buildStoredState(root, session);
			if (hasUsefulAdapterState && snapshot) {
				const updatedSession = withSnapshotRefs(session, snapshot);
				await saveDebugSession(root, updatedSession);
				return {
					ok: true,
					data: {
						mode: input.action,
						session: updatedSession.name,
						runtime: snapshot.runtime,
						state: snapshot.state,
						target: updatedSession.target ?? snapshot.target,
						source:
							input.action === "vars" || input.action === "stack"
								? undefined
								: firstUsefulSource(snapshot.source, stored.source),
						vars:
							input.action === "stack"
								? undefined
								: snapshot.vars ?? stored.vars,
						stack:
							input.action === "vars"
								? undefined
								: snapshot.stack ?? stored.stack,
						breakpoints:
							input.action === "vars"
								? undefined
								: publicBreakpoints(snapshot.breakpoints ?? updatedSession.breakpoints),
					},
				};
			}

			return {
				ok: true,
				data: {
					...stored,
					mode: input.action,
					source:
						input.action === "vars" || input.action === "stack"
							? undefined
							: stored.source,
					vars: input.action === "stack" ? undefined : stored.vars,
					stack: input.action === "vars" ? undefined : stored.stack,
					breakpoints:
						input.action === "vars"
							? undefined
							: publicBreakpoints(session.breakpoints),
				},
			};
		}

		case "break":
		case "logpoint": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const parsed = parseBreakpointTarget(input.target);
			if (!parsed) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_breakpoint",
						"Invalid breakpoint target.",
					),
				};
			}
			if (input.action === "logpoint" && !input.expression) {
				return {
					ok: false,
					error: sdkError("debug.invalid_input", "Logpoint message is required."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let runtimeBreakpoint: DebugBreakpointRef | null = null;
			try {
				runtimeBreakpoint = await adapter.setBreakpoint({
					...parsed,
					message: input.action === "logpoint" ? input.expression : undefined,
				});
			} catch {}

			const breakpoints = assignBreakpointRefs([
				...session.breakpoints.map(({ file, line, column, remoteId, kind, message }) => ({
					file,
					line,
					column,
					remoteId,
					kind,
					message,
				})),
				{
					...parsed,
					remoteId: runtimeBreakpoint?.remoteId,
					kind: input.action === "logpoint" ? "logpoint" : "breakpoint",
					message: input.action === "logpoint" ? input.expression : undefined,
				},
			]);

			await saveDebugSession(root, {
				...session,
				breakpoints,
				refs: {
					...session.refs,
					breakpoints,
				},
			});

			return {
				ok: true,
				data: {
					mode: input.action,
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					breakpoints: publicBreakpoints(breakpoints),
					raw:
						input.action === "logpoint"
							? `Set logpoint ${breakpoints.at(-1)?.ref ?? "BP#?"} at ${parsed.file}:${parsed.line}`
							: undefined,
				},
			};
		}

		case "run-to": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const parsed = parseBreakpointTarget(input.target);
			if (!parsed) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_breakpoint",
						"Invalid breakpoint target.",
					),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				const snapshot = await adapter.runTo(parsed);
			const updatedSession = withSnapshotRefs(
				withSessionSnapshot(session, snapshot),
				snapshot,
			);
				await saveDebugSession(root, updatedSession);

				return {
					ok: true,
					data: {
						mode: "run-to",
						session: updatedSession.name,
						runtime: updatedSession.runtime,
						state: snapshot.state,
						target: updatedSession.target,
						source: snapshot.source,
						console: snapshot.console,
						vars: snapshot.vars,
						stack: snapshot.stack,
					},
				};
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "break-ls": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}
			return {
				ok: true,
				data: {
					mode: "break-ls",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					breakpoints: publicBreakpoints(session.breakpoints),
				},
			};
		}

		case "break-toggle": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const parsed = parseBreakpointTarget(input.target);
			if (!parsed) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_breakpoint",
						"Invalid breakpoint target.",
					),
				};
			}

			const existing = session.breakpoints.find(
				(bp) =>
					bp.file === parsed.file &&
					bp.line === parsed.line &&
					(bp.column ?? undefined) === parsed.column,
			);

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);

			if (existing) {
				try {
					if (existing.remoteId) {
						await adapter.removeBreakpoint(existing.remoteId);
					}
				} catch {}

				const remaining = assignBreakpointRefs(
					session.breakpoints
						.filter((bp) => bp.ref !== existing.ref)
						.map(({ file, line, column, remoteId, kind, message }) => ({
							file,
							line,
							column,
							remoteId,
							kind,
							message,
						})),
				);

				await saveDebugSession(root, {
					...session,
					breakpoints: remaining,
					refs: {
						...session.refs,
						breakpoints: remaining,
					},
				});

				return {
					ok: true,
					data: {
						mode: "break-toggle",
						session: session.name,
						runtime: session.runtime,
						state: session.state,
						target: session.target,
						breakpoints: publicBreakpoints(remaining),
						raw: `${existing.ref} removed from ${parsed.file}:${parsed.line}`,
					},
				};
			}

			let runtimeBreakpoint: DebugBreakpointRef | null = null;
			try {
				runtimeBreakpoint = await adapter.setBreakpoint(parsed);
			} catch {}

			const breakpoints = assignBreakpointRefs([
				...session.breakpoints.map(({ file, line, column, remoteId, kind, message }) => ({
					file,
					line,
					column,
					remoteId,
					kind,
					message,
				})),
				{
					...parsed,
					remoteId: runtimeBreakpoint?.remoteId,
					kind: "breakpoint",
				},
			]);

			await saveDebugSession(root, {
				...session,
				breakpoints,
				refs: {
					...session.refs,
					breakpoints,
				},
			});

			return {
				ok: true,
				data: {
					mode: "break-toggle",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					breakpoints: publicBreakpoints(breakpoints),
					raw: `${breakpoints.at(-1)?.ref ?? "BP#?"} set at ${parsed.file}:${parsed.line}`,
				},
			};
		}

		case "break-rm": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			if (!input.target) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_breakpoint",
						"Breakpoint ref is required.",
					),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				if (input.target === "all") {
					for (const breakpoint of session.breakpoints) {
						if (breakpoint.remoteId) {
							await adapter.removeBreakpoint(breakpoint.remoteId);
						}
					}
				} else {
					const breakpoint = session.breakpoints.find((bp) => bp.ref === input.target);
					if (breakpoint?.remoteId) {
						await adapter.removeBreakpoint(breakpoint.remoteId);
					}
				}
			} catch {}

			const remaining =
				input.target === "all"
					? []
					: assignBreakpointRefs(
							session.breakpoints
								.filter((bp) => bp.ref !== input.target)
								.map(({ file, line, column, remoteId }) => ({
									file,
									line,
									column,
									remoteId,
								})),
						);

			await saveDebugSession(root, {
				...session,
				breakpoints: remaining,
				refs: {
					...session.refs,
					breakpoints: remaining,
				},
			});

			return {
				ok: true,
				data: {
					mode: "break-rm",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					breakpoints: publicBreakpoints(remaining),
					raw:
						input.target === "all"
							? "All breakpoints removed"
							: `${input.target} removed`,
				},
			};
		}

		case "continue": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let snapshot: DebugStateSnapshot | null = null;
			try {
				snapshot = await adapter.continue();
			} catch {}

			const nextState = snapshot?.state ?? "running";
			const updatedSession = withSnapshotRefs(
				withSessionSnapshot(
					{
						...session,
						state: nextState,
						location: snapshot?.location,
					},
					snapshot,
				),
				snapshot,
			);
			await saveDebugSession(root, updatedSession);

			return {
				ok: true,
				data: {
					mode: "continue",
					session: updatedSession.name,
					runtime: updatedSession.runtime,
					state: nextState,
					target: updatedSession.target,
					source: snapshot?.source,
					console: snapshot?.console,
					vars: snapshot?.vars,
					stack: snapshot?.stack,
				},
			};
		}

		case "step": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const mode =
				input.target === "into" || input.target === "out" ? input.target : "over";
			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let snapshot: DebugStateSnapshot | null = null;
			try {
				snapshot = await adapter.step(mode);
			} catch {}

			const nextState = snapshot?.state ?? session.state;
			const updatedSession = withSnapshotRefs(
				withSessionSnapshot(
					{
						...session,
						state: nextState,
						location: snapshot?.location ?? session.location,
					},
					snapshot,
				),
				snapshot,
			);
			await saveDebugSession(root, updatedSession);

			return {
				ok: true,
				data: {
					mode: "step",
					session: updatedSession.name,
					runtime: updatedSession.runtime,
					state: nextState,
					target: updatedSession.target,
					source: snapshot?.source,
					console: snapshot?.console,
					vars: snapshot?.vars,
					stack: snapshot?.stack,
				},
			};
		}

		case "pause": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let snapshot: DebugStateSnapshot | null = null;
			try {
				snapshot = await adapter.pause();
			} catch {}

			const nextState = snapshot?.state ?? session.state;
			const updatedSession = withSnapshotRefs(
				withSessionSnapshot(
					{
						...session,
						state: nextState,
						location: snapshot?.location ?? session.location,
					},
					snapshot,
				),
				snapshot,
			);
			await saveDebugSession(root, updatedSession);

			return {
				ok: true,
				data: {
					mode: "pause",
					session: updatedSession.name,
					runtime: updatedSession.runtime,
					state: nextState,
					target: updatedSession.target,
					source: snapshot?.source,
					console: snapshot?.console,
					vars: snapshot?.vars,
					stack: snapshot?.stack,
				},
			};
		}

		case "source": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let snapshot: DebugStateSnapshot | null = null;
			try {
				snapshot = await adapter.buildState();
			} catch {}

			const stored = await buildStoredState(root, session);
			if (input.target) {
				const parsed = parseBreakpointTarget(input.target);
				const frameRef = session.refs.frames.find((frame) => frame.ref === input.target);
				const sourceTarget =
					parsed ??
					(frameRef && session.location
						? {
								file: session.location.file,
								line: session.location.line,
								column: session.location.column,
							}
						: null);
				if (sourceTarget) {
					const targeted = await readFailureSource(
						sourceTarget.file,
						sourceTarget.line,
					);
					return {
						ok: true,
						data: {
							mode: "source",
							session: session.name,
							runtime: session.runtime,
							state: session.state,
							target: session.target,
							source: targeted ?? firstUsefulSource(snapshot?.source, stored.source),
							stack: snapshot?.stack ?? stored.stack,
						},
					};
				}
			}
			if (snapshot) {
				const updatedSession = withSessionSnapshot(session, snapshot);
				await saveDebugSession(root, updatedSession);
				return {
					ok: true,
					data: {
						mode: "source",
						session: updatedSession.name,
						runtime: updatedSession.runtime,
						state: snapshot.state,
						target: updatedSession.target,
						source: firstUsefulSource(snapshot.source, stored.source),
						console: snapshot.console ?? stored.console,
						stack: snapshot.stack,
					},
				};
			}

			return {
				ok: true,
				data: {
					mode: "source",
					session: stored.session,
					runtime: stored.runtime,
					state: stored.state,
					target: stored.target,
					source: stored.source,
					console: stored.console,
					stack: stored.stack,
				},
			};
		}

		case "scripts": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let scripts = session.scripts ?? [];
			try {
				const liveScripts = await adapter.getScripts();
				if (liveScripts.length > 0) {
					scripts = liveScripts;
					await saveDebugSession(root, {
						...session,
						scripts: liveScripts,
					});
				}
			} catch {}

			return {
				ok: true,
				data: {
					mode: "scripts",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					scripts,
				},
			};
		}

		case "console": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			let consoleEntries = session.console ?? [];
			try {
				const liveConsole = await adapter.getConsole();
				if (liveConsole.length > 0) {
					consoleEntries = liveConsole;
					await saveDebugSession(root, {
						...session,
						console: liveConsole,
					});
				}
			} catch {}

			return {
				ok: true,
				data: {
					mode: "console",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					console: consoleEntries,
				},
			};
		}

		case "catch": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			const mode = parseExceptionPauseMode(input.target);
			if (!mode) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_input",
						"Exception pause mode must be one of: none, uncaught, all.",
					),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				await adapter.setExceptionPauseMode(mode);
			} catch {}

			await saveDebugSession(root, {
				...session,
				exceptionPauseMode: mode,
			});

			return {
				ok: true,
				data: {
					mode: "catch",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					raw: `Exception pause mode set to ${mode}`,
				},
			};
		}

		case "exceptions": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			return {
				ok: true,
				data: {
					mode: "exceptions",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					exception: session.exception,
					raw: session.exception
						? `${session.exception.reason}: ${session.exception.message ?? ""}`.trim()
						: `No exception captured in the current session${
								session.exceptionPauseMode
									? ` (catch=${session.exceptionPauseMode})`
									: ""
							}`,
				},
			};
		}

		case "eval": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}
			if (!input.expression) {
				return {
					ok: false,
					error: sdkError("debug.invalid_input", "Expression is required."),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				const result = await adapter.evaluate({ expression: input.expression });
				const updatedSession = withResultRef(session, result, input.expression);
				await saveDebugSession(root, updatedSession);
				return {
					ok: true,
					data: {
						mode: "eval",
						session: updatedSession.name,
						runtime: updatedSession.runtime,
						state: updatedSession.state,
						target: updatedSession.target,
						result,
					},
				};
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "set": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}
			if (!input.target || !input.expression) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_input",
						"Set requires both a target and a value expression.",
					),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				const result = await adapter.setValue({
					target: input.target,
					value: input.expression,
				});
				const updatedSession = withResultRef(session, result, input.target);
				await saveDebugSession(root, updatedSession);
				return {
					ok: true,
					data: {
						mode: "set",
						session: updatedSession.name,
						runtime: updatedSession.runtime,
						state: updatedSession.state,
						target: updatedSession.target,
						result,
					},
				};
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "props": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}
			if (!input.target) {
				return {
					ok: false,
					error: sdkError("debug.invalid_input", "Value ref is required."),
				};
			}

			const valueRef = session.refs.values.find((value) => value.ref === input.target);
			if (!valueRef?.id) {
				return {
					ok: false,
					error: sdkError(
						"debug.invalid_input",
						"Unknown or non-expandable value ref.",
					),
				};
			}

			const adapter = adapterFactory(session.runtime);
			await hydrateAdapterFromSession(adapter, session);
			try {
				let vars: DebugValueSnapshot[] = [];
				let refreshedId = valueRef.id;
				try {
					vars = await adapter.getProperties(valueRef.id);
				} catch {
					if (!valueRef.name) {
						throw new Error("Unknown or non-expandable value ref.");
					}

					vars = await adapter.getPropertiesFromExpression(valueRef.name);
					if (vars.length === 0) {
						throw new Error("Unknown or non-expandable value ref.");
					}
					refreshedId = undefined;
				}
				const updatedSession = withSnapshotRefs(
					{
						...session,
						refs: {
							...session.refs,
							values: session.refs.values.map((value) =>
								value.ref === valueRef.ref
									? { ...value, id: refreshedId ?? value.id }
									: value,
							),
						},
					},
					{ vars },
				);
				await saveDebugSession(root, updatedSession);
				return {
					ok: true,
					data: {
						mode: "props",
						session: updatedSession.name,
						runtime: updatedSession.runtime,
						state: updatedSession.state,
						target: updatedSession.target,
						vars,
					},
				};
			} catch (error) {
				return {
					ok: false,
					error: sdkError(
						"debug.runtime_error",
						error instanceof Error ? error.message : String(error),
					),
				};
			}
		}

		case "stop": {
			const session = await loadDebugSession(root, sessionName);
			if (!session) {
				return {
					ok: false,
					error: sdkError("debug.no_active_session", "No active debug session."),
				};
			}

			try {
				if (session.target?.pid) {
					process.kill(session.target.pid, "SIGTERM");
				}
			} catch {}

			await deleteDebugSession(root, sessionName);
			return {
				ok: true,
				data: {
					mode: "stop",
					session: sessionName,
					runtime: session.runtime,
					state: "idle",
					raw: `Session "${sessionName}" stopped`,
				},
			};
		}

		default:
			return {
				ok: true,
				data: {
					mode: input.action ?? "help",
					raw: `debug subcommand "${input.action}" not implemented yet`,
				},
			};
	}
}
