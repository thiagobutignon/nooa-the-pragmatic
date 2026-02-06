export type ScrollConfig = {
	totalLines: number;
	viewportLines: number;
};

export type ScrollState = {
	scrollBy: (delta: number) => void;
	pageDown: () => void;
	pageUp: () => void;
	getOffset: () => number;
	setTotalLines: (next: number) => void;
	setViewportLines: (next: number) => void;
};

function clamp(value: number, min: number, max: number) {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

function maxOffset(totalLines: number, viewportLines: number) {
	return Math.max(0, totalLines - viewportLines);
}

export function buildScrollState(config: ScrollConfig): ScrollState {
	let offset = 0;
	let totalLines = Math.max(0, config.totalLines);
	let viewportLines = Math.max(1, config.viewportLines);

	const clampOffset = () => {
		offset = clamp(offset, 0, maxOffset(totalLines, viewportLines));
	};

	return {
		scrollBy(delta) {
			offset += delta;
			clampOffset();
		},
		pageDown() {
			offset += viewportLines;
			clampOffset();
		},
		pageUp() {
			offset -= viewportLines;
			clampOffset();
		},
		getOffset() {
			return offset;
		},
		setTotalLines(next) {
			totalLines = Math.max(0, next);
			clampOffset();
		},
		setViewportLines(next) {
			viewportLines = Math.max(1, next);
			clampOffset();
		},
	};
}
