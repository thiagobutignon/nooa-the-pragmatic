import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execa } from "execa";
import type { SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { createNodeDebugAdapter } from "./adapters/node";
import type {
	DebugAdapter,
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
	vars?: DebugValueSnapshot[];
	stack?: DebugFrameSnapshot[];
	breakpoints?: DebugBreakpointRef[];
	exception?: {
		reason: string;
		message?: string;
	};
	result?: { ref: string; value: string };
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
		stack,
		vars: [],
	};
}

async function hydrateAdapterFromSession(
	adapter: DebugAdapter,
	session: NonNullable<Awaited<ReturnType<typeof loadDebugSession>>>,
): Promise<void> {
	if (!session.target?.wsUrl) {
		return;
	}

	try {
		await adapter.attach({
			target: session.target.wsUrl,
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

	return breakpoints.map(({ ref, file, line, column }, index) => ({
		ref: ref.startsWith("BP#") ? ref : generatedRefs[index]?.ref ?? `BP#${index + 1}`,
		file,
		line,
		column,
	}));
}

function firstUsefulSource(
	...candidates: Array<string[] | undefined>
): string[] | undefined {
	return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0);
}

function detectRuntime(command: string[] | undefined): DebugRuntime | null {
	const bin = command?.[0];
	if (bin === "node") return "node";
	if (bin === "bun") return "bun";
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
				return {
					ok: true,
					data: {
						mode: input.action,
						session: session.name,
						runtime: snapshot.runtime,
						state: snapshot.state,
						target: session.target ?? snapshot.target,
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
								: publicBreakpoints(snapshot.breakpoints ?? session.breakpoints),
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

		case "break": {
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
			let runtimeBreakpoint: DebugBreakpointRef | null = null;
			try {
				runtimeBreakpoint = await adapter.setBreakpoint(parsed);
			} catch {}

			const breakpoints = assignBreakpointRefs([
				...session.breakpoints.map(({ file, line, column, remoteId }) => ({
					file,
					line,
					column,
					remoteId,
				})),
				{
					...parsed,
					remoteId: runtimeBreakpoint?.remoteId,
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
					mode: "break",
					session: session.name,
					runtime: session.runtime,
					state: session.state,
					target: session.target,
					breakpoints: publicBreakpoints(breakpoints),
				},
			};
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
			await saveDebugSession(root, {
				...session,
				state: nextState,
				location: snapshot?.location,
			});

			return {
				ok: true,
				data: {
					mode: "continue",
					session: session.name,
					runtime: session.runtime,
					state: nextState,
					target: session.target,
					source: snapshot?.source,
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
			await saveDebugSession(root, {
				...session,
				state: nextState,
				location: snapshot?.location ?? session.location,
			});

			return {
				ok: true,
				data: {
					mode: "step",
					session: session.name,
					runtime: session.runtime,
					state: nextState,
					target: session.target,
					source: snapshot?.source,
					vars: snapshot?.vars,
					stack: snapshot?.stack,
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
				return {
					ok: true,
					data: {
						mode: "eval",
						session: session.name,
						runtime: session.runtime,
						state: session.state,
						target: session.target,
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
