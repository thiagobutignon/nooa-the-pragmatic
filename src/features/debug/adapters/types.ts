import type { DebugSessionState, DebugTarget } from "../session/types";
import type {
	DebugBreakpointRef,
	DebugExceptionPauseMode,
	DebugRuntime,
} from "../session/types";

export type DebugLaunchInput = {
	command: string[];
	brk?: boolean;
};

export type DebugAttachInput = {
	target: string;
	command?: string[];
	state?: DebugSessionState;
};

export type DebugBreakpointInput = {
	file: string;
	line: number;
	column?: number;
	message?: string;
};

export type DebugInspectAtInput = {
	command: string[];
	target: DebugBreakpointInput;
};

export type DebugInspectOnFailureInput = {
	command: string[];
};

export type DebugCaptureInput = {
	command: string[];
};

export type DebugEvalInput = {
	expression: string;
	frame?: string;
};

export type DebugSetInput = {
	target: string;
	value: string;
	frame?: string;
};

export type DebugValueSnapshot = {
	ref: string;
	name: string;
	value: string;
	scope?: string;
	id?: string;
};

export type DebugFrameSnapshot = {
	ref: string;
	name: string;
	file: string;
	line: number;
	column?: number;
	id?: string;
};

export type DebugExceptionSnapshot = {
	reason: string;
	message?: string;
};

export type DebugConsoleEntry = {
	level: string;
	text: string;
};

export type DebugScriptEntry = {
	id?: string;
	url: string;
};

export type DebugStateSnapshot = {
	runtime: DebugRuntime;
	state: DebugSessionState;
	target?: DebugTarget;
	location?: {
		file: string;
		line: number;
		column?: number;
	};
	source?: string[];
	vars?: DebugValueSnapshot[];
	stack?: DebugFrameSnapshot[];
	breakpoints?: DebugBreakpointRef[];
	exception?: DebugExceptionSnapshot;
	console?: DebugConsoleEntry[];
	scripts?: DebugScriptEntry[];
};

export type DebugEvalResult = {
	ref: string;
	value: string;
	id?: string;
};

export interface DebugAdapter {
	launch(input: DebugLaunchInput): Promise<DebugStateSnapshot>;
	attach(input: DebugAttachInput): Promise<DebugStateSnapshot>;
	status(): Promise<DebugStateSnapshot>;
	stop(): Promise<void>;
	capture(input: DebugCaptureInput): Promise<DebugStateSnapshot>;
	inspectAt(input: DebugInspectAtInput): Promise<DebugStateSnapshot>;
	inspectOnFailure(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot>;
	runTo(input: DebugBreakpointInput): Promise<DebugStateSnapshot>;
	setBreakpoint(input: DebugBreakpointInput): Promise<DebugBreakpointRef>;
	listBreakpoints(): Promise<DebugBreakpointRef[]>;
	removeBreakpoint(ref: string): Promise<void>;
	continue(): Promise<DebugStateSnapshot>;
	step(mode: "over" | "into" | "out"): Promise<DebugStateSnapshot>;
	pause(): Promise<DebugStateSnapshot>;
	buildState(): Promise<DebugStateSnapshot>;
	getProperties(objectId: string): Promise<DebugValueSnapshot[]>;
	getPropertiesFromExpression(expression: string): Promise<DebugValueSnapshot[]>;
	getConsole(): Promise<DebugConsoleEntry[]>;
	getScripts(): Promise<DebugScriptEntry[]>;
	setExceptionPauseMode(mode: DebugExceptionPauseMode): Promise<void>;
	getVars(): Promise<DebugValueSnapshot[]>;
	evaluate(input: DebugEvalInput): Promise<DebugEvalResult>;
	setValue(input: DebugSetInput): Promise<DebugEvalResult>;
}
