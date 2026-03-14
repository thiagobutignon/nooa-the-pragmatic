export type DebugRuntime = "node" | "bun";

export type DebugSessionState = "idle" | "running" | "paused";

export type DebugLocation = {
	file: string;
	line: number;
	column?: number;
};

export type DebugTarget = {
	command: string[];
	pid?: number;
	wsUrl?: string;
};

export type DebugFrameRef = {
	ref: string;
	id?: string;
	name?: string;
};

export type DebugValueRef = {
	ref: string;
	id?: string;
	name?: string;
};

export type DebugBreakpointRef = {
	ref: string;
	file: string;
	line: number;
	column?: number;
	remoteId?: string;
	kind?: "breakpoint" | "logpoint";
	message?: string;
};

export type DebugConsoleRef = {
	level: string;
	text: string;
};

export type DebugScriptRef = {
	id?: string;
	url: string;
};

export type DebugExceptionPauseMode = "none" | "uncaught" | "all";

export type DebugSessionRefs = {
	frames: DebugFrameRef[];
	values: DebugValueRef[];
	breakpoints: DebugBreakpointRef[];
};

export type DebugSessionRecord = {
	name: string;
	runtime: DebugRuntime;
	state: DebugSessionState;
	createdAt: string;
	updatedAt: string;
	target?: DebugTarget;
	location?: DebugLocation;
	breakpoints: DebugBreakpointRef[];
	exceptionPauseMode?: DebugExceptionPauseMode;
	exception?: {
		reason: string;
		message?: string;
	};
	console?: DebugConsoleRef[];
	scripts?: DebugScriptRef[];
	refs: DebugSessionRefs;
};

export type DebugSessionsState = {
	version: string;
	sessions: Record<string, DebugSessionRecord>;
};
