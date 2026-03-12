import type { DebugSessionState, DebugTarget } from "../session/types";
import type {
	DebugBreakpointRef,
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

export type DebugValueSnapshot = {
	ref: string;
	name: string;
	value: string;
	scope?: string;
};

export type DebugFrameSnapshot = {
	ref: string;
	name: string;
	file: string;
	line: number;
	column?: number;
};

export type DebugExceptionSnapshot = {
	reason: string;
	message?: string;
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
};

export type DebugEvalResult = {
	ref: string;
	value: string;
};

export interface DebugAdapter {
	launch(input: DebugLaunchInput): Promise<DebugStateSnapshot>;
	attach(input: DebugAttachInput): Promise<DebugStateSnapshot>;
	status(): Promise<DebugStateSnapshot>;
	stop(): Promise<void>;
	capture(input: DebugCaptureInput): Promise<DebugStateSnapshot>;
	inspectAt(input: DebugInspectAtInput): Promise<DebugStateSnapshot>;
	inspectOnFailure(input: DebugInspectOnFailureInput): Promise<DebugStateSnapshot>;
	setBreakpoint(input: DebugBreakpointInput): Promise<DebugBreakpointRef>;
	listBreakpoints(): Promise<DebugBreakpointRef[]>;
	removeBreakpoint(ref: string): Promise<void>;
	continue(): Promise<DebugStateSnapshot>;
	step(mode: "over" | "into" | "out"): Promise<DebugStateSnapshot>;
	buildState(): Promise<DebugStateSnapshot>;
	getVars(): Promise<DebugValueSnapshot[]>;
	evaluate(input: DebugEvalInput): Promise<DebugEvalResult>;
}
