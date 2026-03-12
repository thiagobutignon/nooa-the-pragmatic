import type { DebugBreakpointRef } from "./session/types";
import type { DebugFrameSnapshot, DebugValueSnapshot } from "./adapters/types";

export function assignFrameRefs(
	frames: Array<Omit<DebugFrameSnapshot, "ref">>,
): DebugFrameSnapshot[] {
	return frames.map((frame, index) => ({
		...frame,
		ref: `@f${index}`,
	}));
}

export function assignValueRefs(
	values: Array<Omit<DebugValueSnapshot, "ref">>,
): DebugValueSnapshot[] {
	return values.map((value, index) => ({
		...value,
		ref: `@v${index + 1}`,
	}));
}

export function assignBreakpointRefs(
	breakpoints: Array<Omit<DebugBreakpointRef, "ref">>,
): DebugBreakpointRef[] {
	return breakpoints.map((breakpoint, index) => ({
		...breakpoint,
		ref: `BP#${index + 1}`,
	}));
}
