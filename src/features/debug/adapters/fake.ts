import type {
	DebugBreakpointRef,
	DebugExceptionPauseMode,
	DebugRuntime,
	DebugTarget,
} from "../session/types";
import type {
	DebugAdapter,
	DebugAttachInput,
	DebugBreakpointInput,
	DebugEvalInput,
	DebugEvalResult,
	DebugFrameSnapshot,
	DebugInspectAtInput,
	DebugInspectOnFailureInput,
	DebugLaunchInput,
	DebugStateSnapshot,
	DebugValueSnapshot,
} from "./types";

type FakeState = {
	runtime: DebugRuntime;
	state: "idle" | "running" | "paused";
	target?: DebugTarget;
	location?: { file: string; line: number; column?: number };
	breakpoints: DebugBreakpointRef[];
};

class FakeDebugAdapter implements DebugAdapter {
	private breakpointCounter = 0;
	private valueCounter = 0;
	private exceptionPauseMode: DebugExceptionPauseMode = "none";
	private state: FakeState;

	constructor(runtime: DebugRuntime) {
		this.state = {
			runtime,
			state: "idle",
			breakpoints: [],
		};
	}

	async launch(input: DebugLaunchInput): Promise<DebugStateSnapshot> {
		this.state = {
			...this.state,
			state: input.brk ? "paused" : "running",
			target: { command: input.command, pid: 99999 },
			location: input.brk
				? { file: input.command.at(-1) ?? "app.js", line: 1, column: 1 }
				: undefined,
		};
		this.valueCounter = 0;
		return this.buildState();
	}

	async attach(input: DebugAttachInput): Promise<DebugStateSnapshot> {
		this.state = {
			...this.state,
			state: input.state ?? "paused",
			target: {
				command: input.command ?? ["attach", input.target],
				wsUrl: input.target,
			},
			location: { file: "attached.js", line: 1, column: 1 },
		};
		return this.buildState();
	}

	async status(): Promise<DebugStateSnapshot> {
		return this.buildState();
	}

	async stop(): Promise<void> {
		this.state = {
			runtime: this.state.runtime,
			state: "idle",
			breakpoints: [],
		};
	}

	async capture(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot> {
		await this.launch({ command: input.command, brk: true });
		this.state.state = "paused";
		this.state.location = {
			file: input.command.at(-1) ?? "app.js",
			line: 1,
			column: 1,
		};
		return this.buildState();
	}

	async inspectAt(input: DebugInspectAtInput): Promise<DebugStateSnapshot> {
		await this.launch({ command: input.command, brk: true });
		await this.setBreakpoint(input.target);
		this.state.state = "paused";
		this.state.location = {
			file: input.target.file,
			line: input.target.line,
			column: input.target.column ?? 1,
		};
		return this.buildState();
	}

	async inspectOnFailure(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot> {
		await this.launch({ command: input.command, brk: true });
		this.state.state = "paused";
		this.state.location = {
			file: input.command.at(-1) ?? "app.js",
			line: 2,
			column: 1,
		};
		return {
			...(await this.buildState()),
			exception: {
				reason: "exception",
				message: "Error: boom",
			},
		};
	}

	async runTo(input: DebugBreakpointInput): Promise<DebugStateSnapshot> {
		await this.setBreakpoint(input);
		this.state.state = "paused";
		this.state.location = {
			file: input.file,
			line: input.line,
			column: input.column ?? 1,
		};
		return this.buildState();
	}

	async setBreakpoint(
		input: DebugBreakpointInput,
	): Promise<DebugBreakpointRef> {
		const bp: DebugBreakpointRef = {
			ref: `BP#${++this.breakpointCounter}`,
			file: input.file,
			line: input.line,
			column: input.column,
			kind: input.message ? "logpoint" : "breakpoint",
			message: input.message,
		};
		this.state.breakpoints.push(bp);
		return bp;
	}

	async listBreakpoints(): Promise<DebugBreakpointRef[]> {
		return [...this.state.breakpoints];
	}

	async removeBreakpoint(ref: string): Promise<void> {
		if (ref === "all") {
			this.state.breakpoints = [];
			return;
		}
		this.state.breakpoints = this.state.breakpoints.filter((bp) => bp.ref !== ref);
	}

	async continue(): Promise<DebugStateSnapshot> {
		const nextBreakpoint = this.state.breakpoints[0];
		if (nextBreakpoint) {
			this.state.state = "paused";
			this.state.location = {
				file: nextBreakpoint.file,
				line: nextBreakpoint.line,
				column: nextBreakpoint.column ?? 1,
			};
			return this.buildState();
		}

		this.state.state = "running";
		this.state.location = undefined;
		return this.buildState();
	}

	async step(mode: "over" | "into" | "out"): Promise<DebugStateSnapshot> {
		this.state.state = "paused";
		this.state.location = {
			file: this.state.target?.command.at(-1) ?? "app.js",
			line: mode === "into" ? 2 : mode === "out" ? 4 : 3,
			column: 1,
		};
		return this.buildState();
	}

	async pause(): Promise<DebugStateSnapshot> {
		this.state.state = "paused";
		this.state.location = {
			file: this.state.target?.command.at(-1) ?? "app.js",
			line: 2,
			column: 1,
		};
		return this.buildState();
	}

	async buildState(): Promise<DebugStateSnapshot> {
		const source =
			this.state.state === "paused"
				? [
						"const foo = 1;",
						"const bar = 2;",
						"const baz = foo + bar;",
					]
				: undefined;

		const vars =
			this.state.state === "paused"
				? this.makeVars([
						["foo", "1"],
						["bar", "2"],
					])
				: undefined;

		const stack =
			this.state.state === "paused"
				? this.makeFrames([
						{
							name: "(anonymous)",
							file: this.state.location?.file ?? "app.js",
							line: this.state.location?.line ?? 1,
							column: this.state.location?.column,
						},
					])
				: undefined;

		return {
			runtime: this.state.runtime,
			state: this.state.state,
			target: this.state.target,
			location: this.state.location,
			source,
			vars,
			stack,
			breakpoints: [...this.state.breakpoints],
			console:
				this.state.state === "paused"
					? [{ level: "log", text: "fake console: paused session" }]
					: [],
		};
	}

	async getConsole() {
		return [{ level: "log", text: "fake console: paused session" }];
	}

	async getScripts() {
		return [
			{ id: "script:1", url: "file:///workspace/app.js" },
			{ id: "script:2", url: "node:internal/timers" },
		];
	}

	async setExceptionPauseMode(mode: DebugExceptionPauseMode) {
		this.exceptionPauseMode = mode;
	}

	async getVars(): Promise<DebugValueSnapshot[]> {
		return this.state.state === "paused"
			? this.makeVars([
					["foo", "1"],
					["bar", "{ nested: true }", "obj:bar"],
				])
			: [];
	}

	async getProperties(objectId: string): Promise<DebugValueSnapshot[]> {
		if (objectId !== "obj:bar") {
			return [];
		}

		return this.makeVars([
			["nested", "true"],
			["count", "2"],
		]);
	}

	async getPropertiesFromExpression(expression: string): Promise<DebugValueSnapshot[]> {
		if (expression === "bar" || expression === "globalThis.payload") {
			return this.getProperties("obj:bar");
		}

		return [];
	}

	async evaluate(input: DebugEvalInput): Promise<DebugEvalResult> {
		return {
			ref: `@v${++this.valueCounter + 2}`,
			value: input.expression === "bar" ? "{ nested: true }" : `"fake:${input.expression}"`,
			id: input.expression === "bar" ? "obj:bar" : undefined,
		};
	}

	private makeVars(entries: Array<[string, string, string?]>): DebugValueSnapshot[] {
		return entries.map(([name, value, id], index) => ({
			ref: `@v${index + 1}`,
			name,
			value,
			scope: "local",
			id,
		}));
	}

	private makeFrames(
		entries: Array<{ name: string; file: string; line: number; column?: number }>,
	): DebugFrameSnapshot[] {
		return entries.map((entry, index) => ({
			ref: `@f${index}`,
			name: entry.name,
			file: entry.file,
			line: entry.line,
			column: entry.column,
		}));
	}
}

export function createFakeDebugAdapter(runtime: DebugRuntime): DebugAdapter {
	return new FakeDebugAdapter(runtime);
}
