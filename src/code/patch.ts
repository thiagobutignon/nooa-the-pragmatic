export type PatchResult = {
	ok: boolean;
	result?: string;
	error?: string;
};

type Hunk = {
	startOriginal: number;
	lengthOriginal: number;
	startNew: number;
	lengthNew: number;
	lines: string[];
};

function parseHunkHeader(header: string): Hunk {
	const match = /^@@\s-([0-9]+),?([0-9]*)\s\+([0-9]+),?([0-9]*)\s@@/.exec(
		header,
	);
	if (!match) {
		throw new Error("Invalid hunk header");
	}

	const startOriginal = Number.parseInt(match[1], 10);
	const lengthOriginal = match[2]
		? Number.parseInt(match[2], 10)
		: 1;
	const startNew = Number.parseInt(match[3], 10);
	const lengthNew = match[4] ? Number.parseInt(match[4], 10) : 1;

	return {
		startOriginal,
		lengthOriginal,
		startNew,
		lengthNew,
		lines: [],
	};
}

export function applyPatch(original: string, patch: string): string {
	const originalLines = original.split("\n");
	const patchLines = patch.split("\n");

	const hunks: Hunk[] = [];
	let currentHunk: Hunk | undefined;

	for (const line of patchLines) {
		if (line.startsWith("@@")) {
			currentHunk = parseHunkHeader(line);
			hunks.push(currentHunk);
			continue;
		}
		if (currentHunk) {
			if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
				currentHunk.lines.push(line);
			}
		}
	}

	let offset = 0;
	const output = [...originalLines];

	for (const hunk of hunks) {
		const startIndex = hunk.startOriginal - 1 + offset;
		const target = output.slice(startIndex, startIndex + hunk.lengthOriginal);
		const expected: string[] = [];
		const replacement: string[] = [];

		for (const line of hunk.lines) {
			const marker = line[0];
			const content = line.slice(1);
			if (marker === " ") {
				expected.push(content);
				replacement.push(content);
			} else if (marker === "-") {
				expected.push(content);
			} else if (marker === "+") {
				replacement.push(content);
			}
		}

		if (expected.join("\n") !== target.join("\n")) {
			throw new Error("Patch conflict: context does not match");
		}

		output.splice(startIndex, hunk.lengthOriginal, ...replacement);
		offset += replacement.length - hunk.lengthOriginal;
	}

	return output.join("\n");
}
