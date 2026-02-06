export type MouseScrollDirection = "up" | "down";

export function parseMouseScroll(payload: string): MouseScrollDirection | null {
	const match = payload.match(/\u001b\[<([0-9]+);([0-9]+);([0-9]+)([mM])/);
	if (!match) return null;
	const code = Number.parseInt(match[1] ?? "", 10);
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
