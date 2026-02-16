export type MouseScrollDirection = "up" | "down";

export function parseMouseScroll(payload: string): MouseScrollDirection | null {
	const prefix = "\u001b[<";
	if (!payload.startsWith(prefix)) return null;
	const body = payload.slice(prefix.length);
	const terminatorIndex = body.search(/[mM]/);
	if (terminatorIndex < 0) return null;
	const parts = body.slice(0, terminatorIndex).split(";");
	const code = Number.parseInt(parts[0] ?? "", 10);
	if (Number.isNaN(code)) return null;
	if (code === 64) return "up";
	if (code === 65) return "down";
	return null;
}

export function enableMouseTracking() {
	return "\u001b[?1000h\u001b[?1006h";
}

export function disableMouseTracking() {
	return "\u001b[?1000l\u001b[?1006l";
}
