import {
	filterMatchedFiles,
	parseRunnerArgs,
} from "./run-bun-tests-isolated-lib";

const defaultConcurrency = 1;
const { cliFlags, concurrency, filters } = parseRunnerArgs(
	process.argv.slice(2),
	defaultConcurrency,
);
const files: string[] = [];

for await (const file of new Bun.Glob("**/*.{test,spec}.{ts,tsx,js,jsx}").scan(
	".",
)) {
	if (
		file.startsWith("node_modules/") ||
		file.startsWith(".git/") ||
		file.startsWith(".worktrees/")
	) {
		continue;
	}
	files.push(file);
}

const matchedFiles = filterMatchedFiles(files, filters);
const bunBinary = Bun.which("bun") ?? process.execPath;

if (matchedFiles.length === 0) {
	console.log("No test files matched.");
	process.exit(0);
}

let nextFileIndex = 0;
let failedExitCode: number | undefined;
let totalTestCases = 0;
let totalCompletedFiles = 0;
const failedFiles: Array<{ file: string; exitCode: number }> = [];
const activeProcesses = new Set<ReturnType<typeof Bun.spawn>>();

async function forwardStream(
	stream: ReadableStream<Uint8Array> | null,
	writer: (chunk: string) => void,
): Promise<string> {
	if (!stream) {
		return "";
	}

	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let captured = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		const chunk = decoder.decode(value, { stream: true });
		captured += chunk;
		writer(chunk);
	}

	const finalChunk = decoder.decode();
	captured += finalChunk;
	if (finalChunk) {
		writer(finalChunk);
	}

	return captured;
}

function extractTestCount(output: string): number {
	const match = output.match(/Ran\s+(\d+)\s+tests?\s+across\s+\d+\s+files?\./);
	if (!match) {
		return 0;
	}

	return Number.parseInt(match[1] ?? "0", 10);
}

const runNextTestFile = async () => {
	while (failedExitCode === undefined && nextFileIndex < matchedFiles.length) {
		const file = matchedFiles[nextFileIndex++];
		console.log(`\n==> bun test ${[...cliFlags, file].join(" ")}`);

		const testProcess = Bun.spawn([bunBinary, "test", ...cliFlags, file], {
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		});

		activeProcesses.add(testProcess);

		const [stdout, stderr, exitCode] = await Promise.all([
			forwardStream(testProcess.stdout, (chunk) => process.stdout.write(chunk)),
			forwardStream(testProcess.stderr, (chunk) => process.stderr.write(chunk)),
			testProcess.exited,
		]);

		activeProcesses.delete(testProcess);
		totalCompletedFiles += 1;
		totalTestCases += extractTestCount(stdout + stderr);

		if (exitCode !== 0) {
			failedExitCode = exitCode;
			failedFiles.push({ file, exitCode });

			for (const activeProcess of activeProcesses) {
				activeProcess.kill();
			}
		}
	}
};

await Promise.all(
	Array.from(
		{ length: Math.min(concurrency, matchedFiles.length) },
		runNextTestFile,
	),
);

if (failedExitCode !== undefined) {
	console.error("\nTest summary:");
	console.error(`- Completed files: ${totalCompletedFiles}/${matchedFiles.length}`);
	console.error(`- Total tests run: ${totalTestCases}`);
	console.error("- Failed files:");
	for (const failedFile of failedFiles) {
		console.error(`  - ${failedFile.file} (exit ${failedFile.exitCode})`);
	}
	process.exit(failedExitCode);
}

console.log("\nTest summary:");
console.log(`- Completed files: ${totalCompletedFiles}/${matchedFiles.length}`);
console.log(`- Total tests run: ${totalTestCases}`);
console.log("- Failed files: none");
