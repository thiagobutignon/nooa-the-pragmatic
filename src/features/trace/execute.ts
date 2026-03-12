import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { type Options as ExecaOptions, execa } from "execa";
import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult } from "../../core/types";
import { saveTrace, type TraceArtifact } from "./storage";

export interface TraceInspectInput {
	action?: "inspect";
	command?: string[];
	cwd?: string;
}

export interface TraceInspectResult extends TraceArtifact {
	mode: "inspect";
}

export interface TraceExecutionCapture {
	artifact: TraceArtifact;
	stdout: string;
	stderr: string;
}

type ExecaLike = (
	file: string,
	args: string[],
	options: ExecaOptions,
) => Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
	signal?: string | null;
}>;

function detectRuntime(command: string[] | undefined): "node" | "bun" | "nooa" | null {
	const file = command?.[0];
	if (!file) return null;
	const name = basename(file);
	if (name === "node" || name === "bun" || name === "nooa") return name;
	return null;
}

function summarizeStream(text: string, maxLength = 400) {
	const trimmed = text.trim();
	if (!trimmed) return "";
	return trimmed.length <= maxLength
		? trimmed
		: `${trimmed.slice(0, maxLength - 3)}...`;
}

async function snapshotFiles(root: string, current = ""): Promise<string[]> {
	const dir = current ? join(root, current) : root;
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const relativePath = current ? join(current, entry.name) : entry.name;
		if (relativePath === ".git" || relativePath.startsWith(".git/")) {
			continue;
		}
		if (relativePath === ".nooa" || relativePath.startsWith(".nooa/")) {
			continue;
		}
		if (entry.isDirectory()) {
			files.push(...(await snapshotFiles(root, relativePath)));
			continue;
		}
		files.push(relativePath);
	}

	return files.sort();
}

function diffTouchedFiles(before: string[], after: string[]) {
	const beforeSet = new Set(before);
	const afterSet = new Set(after);
	return [...after.filter((file) => !beforeSet.has(file)), ...before.filter((file) => !afterSet.has(file))];
}

export async function executeTraceInspect(
	input: TraceInspectInput,
	runCommand: ExecaLike = execa,
): Promise<TraceInspectResult> {
	const capture = await captureTraceExecution(input, runCommand);
	return {
		mode: "inspect",
		...capture.artifact,
	};
}

export async function captureTraceExecution(
	input: TraceInspectInput,
	runCommand: ExecaLike = execa,
): Promise<TraceExecutionCapture> {
	const runtime = detectRuntime(input.command);
	if (!runtime || !input.command?.length) {
		throw new Error("trace.invalid_target");
	}

	const cwd = input.cwd ?? process.cwd();
	const traceId = createTraceId();
	const spanId = `${traceId}:0`;
	const startedAt = new Date().toISOString();
	const startTime = Date.now();
	const beforeFiles = await snapshotFiles(cwd);

	const [file, ...args] = input.command;
	const result = await runCommand(file, args, {
		cwd,
		reject: false,
		env: {
			...process.env,
			NOOA_DISABLE_REFLECTION: "1",
		},
	});

	const afterFiles = await snapshotFiles(cwd);
	const artifact: TraceArtifact = {
		traceId,
		parentTraceId: null,
		spanId,
		command: input.command,
		cwd,
		startedAt,
		finishedAt: new Date().toISOString(),
		durationMs: Date.now() - startTime,
		exitCode: result.exitCode ?? null,
		signal: result.signal ?? null,
		stdoutSummary: summarizeStream(result.stdout),
		stderrSummary: summarizeStream(result.stderr),
		subprocesses: [],
		filesTouched: diffTouchedFiles(beforeFiles, afterFiles),
		links: {},
	};

	await saveTrace(cwd, artifact);
	return {
		artifact,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

export async function runTrace(
	input: TraceInspectInput,
	runCommand?: ExecaLike,
): Promise<SdkResult<TraceInspectResult>> {
	if (input.action !== "inspect") {
		return {
			ok: false,
			error: sdkError("trace.missing_subcommand", "Missing subcommand."),
		};
	}

	const runtime = detectRuntime(input.command);
	if (!runtime) {
		return {
			ok: false,
			error: sdkError(
				"trace.invalid_target",
				"Unsupported or missing runtime command.",
			),
		};
	}

	try {
		return {
			ok: true,
			data: await executeTraceInspect(input, runCommand),
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError(
				"trace.runtime_error",
				error instanceof Error ? error.message : String(error),
			),
		};
	}
}
