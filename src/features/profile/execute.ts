import { access, mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type Options as ExecaOptions, execa } from "execa";
import { createTraceId } from "../../core/logger";

export type CpuProfileNode = {
	id: number;
	callFrame: {
		functionName: string;
		scriptId: string;
		url: string;
		lineNumber: number;
		columnNumber: number;
	};
	hitCount?: number;
	children?: number[];
};

export type CpuProfile = {
	nodes: CpuProfileNode[];
	samples?: number[];
	timeDeltas?: number[];
};

export type ProfileHotspot = {
	function: string;
	url: string;
	line: number;
	column: number;
	self_ms: number;
	samples: number;
};

export type ProfileSummary = {
	total_samples: number;
	total_profiled_ms: number;
	hotspots: ProfileHotspot[];
};

export interface ProfileRunInput {
	action?: "inspect";
	command?: string[];
	cwd?: string;
}

export interface ProfileRunResult extends ProfileSummary {
	mode: "inspect";
	traceId: string;
	runtime: "node" | "bun";
	command: string[];
	exit_code: number;
	duration_ms: number;
	profile_path: string;
	stdout: string;
	stderr: string;
}

function createRuntimeError(message: string) {
	return {
		ok: false as const,
		error: {
			code: "profile.runtime_error",
			message,
		},
	};
}

type ExecaLike = (
	file: string,
	args: string[],
	options: ExecaOptions,
) => Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}>;

function detectRuntime(command: string[] | undefined): "node" | "bun" | null {
	const file = command?.[0];
	if (!file) return null;
	const name = basename(file);
	if (name === "node") return "node";
	if (name === "bun") return "bun";
	return null;
}

async function ensureProfileDir(root: string) {
	const dir = join(root, ".nooa", "profile");
	await mkdir(dir, { recursive: true });
	return dir;
}

async function loadCpuProfile(path: string): Promise<CpuProfile> {
	const raw = await readFile(path, "utf-8");
	return JSON.parse(raw) as CpuProfile;
}

async function waitForProfile(path: string, timeoutMs = 1500) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await access(path);
			return;
		} catch {}
		await Bun.sleep(25);
	}

	throw new Error(`profile.runtime_error: missing CPU profile at ${path}`);
}

export function summarizeCpuProfile(profile: CpuProfile): ProfileSummary {
	const sampleCounts = new Map<number, number>();
	const sampleMicros = new Map<number, number>();

	for (const sample of profile.samples ?? []) {
		sampleCounts.set(sample, (sampleCounts.get(sample) ?? 0) + 1);
	}

	for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
		const nodeId = profile.samples?.[index];
		if (nodeId === undefined) continue;
		const micros = profile.timeDeltas?.[index] ?? 0;
		sampleMicros.set(nodeId, (sampleMicros.get(nodeId) ?? 0) + micros);
	}

	const hotspots = profile.nodes
		.map((node) => {
			const samples = sampleCounts.get(node.id) ?? node.hitCount ?? 0;
			const self_ms =
				Math.round(((sampleMicros.get(node.id) ?? 0) / 1000) * 100) / 100;
			return {
				function: node.callFrame.functionName || "(anonymous)",
				url: node.callFrame.url || "<unknown>",
				line: Math.max(1, node.callFrame.lineNumber + 1),
				column: Math.max(1, node.callFrame.columnNumber + 1),
				self_ms,
				samples,
			};
		})
		.filter((node) => node.samples > 0 || node.self_ms > 0)
		.sort((left, right) => {
			const leftUserCode =
				left.url.startsWith("file://") || left.url.startsWith("/");
			const rightUserCode =
				right.url.startsWith("file://") || right.url.startsWith("/");
			if (leftUserCode !== rightUserCode) {
				return leftUserCode ? -1 : 1;
			}
			if (right.self_ms !== left.self_ms) return right.self_ms - left.self_ms;
			if (right.samples !== left.samples) return right.samples - left.samples;
			return left.function.localeCompare(right.function);
		})
		.slice(0, 10);

	const total_samples =
		(profile.samples?.length ?? 0) ||
		hotspots.reduce((sum, node) => sum + node.samples, 0);
	const total_profiled_ms =
		Math.round(
			((profile.timeDeltas ?? []).reduce((sum, delta) => sum + delta, 0) /
				1000) *
				100,
		) / 100;

	return {
		total_samples,
		total_profiled_ms,
		hotspots,
	};
}

export async function executeProfileInspect(
	input: ProfileRunInput,
	runCommand: ExecaLike = execa,
): Promise<ProfileRunResult> {
	const runtime = detectRuntime(input.command);
	if (!runtime || !input.command?.length) {
		throw new Error("profile.invalid_target");
	}

	const cwd = input.cwd ?? process.cwd();
	const traceId = createTraceId();
	const profileDir = await ensureProfileDir(cwd);
	const profileName = `profile-${traceId}.cpuprofile`;
	const durationStart = Date.now();

	const [file, ...rest] = input.command;
	const profiledArgs = [
		"--cpu-prof",
		`--cpu-prof-dir=${profileDir}`,
		`--cpu-prof-name=${profileName}`,
		...rest,
	];

	const result = await runCommand(file, profiledArgs, {
		cwd,
		reject: false,
		env: process.env,
	});

	const profilePath = join(profileDir, profileName);
	try {
		await waitForProfile(profilePath);
	} catch (error) {
		const detail = result.stderr.trim();
		if (detail) {
			throw new Error(
				`${error instanceof Error ? error.message : "profile.runtime_error: missing CPU profile"}\nstderr: ${detail}`,
			);
		}
		throw error;
	}
	const profile = await loadCpuProfile(profilePath);
	const summary = summarizeCpuProfile(profile);

	return {
		mode: "inspect",
		traceId,
		runtime,
		command: input.command,
		exit_code: result.exitCode,
		duration_ms: Date.now() - durationStart,
		profile_path: profilePath,
		stdout: result.stdout,
		stderr: result.stderr,
		...summary,
	};
}

export async function run(input: ProfileRunInput, runCommand?: ExecaLike) {
	if (input.action !== "inspect") {
		return {
			ok: false as const,
			error: {
				code: "profile.invalid_action",
				message: "Action is required.",
			},
		};
	}

	const runtime = detectRuntime(input.command);
	if (!runtime) {
		return {
			ok: false as const,
			error: {
				code: "profile.invalid_target",
				message: "Unsupported or missing runtime command.",
			},
		};
	}

	try {
		const data = await executeProfileInspect(input, runCommand);
		return {
			ok: true as const,
			data,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Profiling failed unexpectedly.";
		if (message.startsWith("profile.invalid_target")) {
			return {
				ok: false as const,
				error: {
					code: "profile.invalid_target",
					message: "Unsupported or missing runtime command.",
				},
			};
		}
		if (message.startsWith("profile.runtime_error:")) {
			return createRuntimeError(message.replace("profile.runtime_error: ", ""));
		}
		return createRuntimeError(message);
	}
}
