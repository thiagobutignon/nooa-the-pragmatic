const flagsWithValues = new Set([
	"--coverage-reporter",
	"--coverage-dir",
	"--preload",
	"--reporter",
	"--rerun-each",
	"--test-name-pattern",
	"--timeout",
	"-t",
]);

export function parseRunnerArgs(
	args: string[],
	defaultConcurrency: number,
): {
	cliFlags: string[];
	concurrency: number;
	filters: string[];
} {
	const cliFlags: string[] = [];
	const filters: string[] = [];
	let concurrency = defaultConcurrency;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--concurrency" || arg === "-j") {
			const value = args[index + 1];
			if (!value) {
				throw new Error(`${arg} requires a value`);
			}
			const parsed = Number.parseInt(value, 10);
			if (!Number.isFinite(parsed) || parsed < 1) {
				throw new Error(`Invalid concurrency value: ${value}`);
			}
			concurrency = parsed;
			index += 1;
			continue;
		}

		if (!arg.startsWith("-")) {
			filters.push(arg);
			continue;
		}

		cliFlags.push(arg);
		if (flagsWithValues.has(arg)) {
			const value = args[index + 1];
			if (!value) {
				throw new Error(`${arg} requires a value`);
			}
			cliFlags.push(value);
			index += 1;
		}
	}

	return { cliFlags, concurrency, filters };
}

export function filterMatchedFiles(files: string[], filters: string[]): string[] {
	if (filters.length === 0) {
		return [...files].sort();
	}

	return files
		.filter((file) => filters.some((filter) => file.includes(filter)))
		.sort();
}
