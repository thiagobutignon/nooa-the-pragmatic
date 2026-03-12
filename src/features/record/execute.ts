import { createTraceId } from "../../core/logger";
import { sdkError, type SdkResult } from "../../core/types";
import { captureTraceExecution, sanitizeEnvironment } from "../trace/execute";
import { updateTrace } from "../trace/storage";
import { saveRecord, type RecordArtifact } from "./storage";

export interface RecordInspectInput {
	action?: "inspect";
	command?: string[];
	cwd?: string;
}

export interface RecordInspectResult extends RecordArtifact {
	mode: "inspect";
}

export async function executeRecordInspect(
	input: RecordInspectInput,
): Promise<RecordInspectResult> {
	const traceCapture = await captureTraceExecution({
		action: "inspect",
		command: input.command,
		cwd: input.cwd,
	});
	const trace = traceCapture.artifact;

	const cwd = input.cwd ?? process.cwd();
	const recordId = createTraceId();
	const record: RecordInspectResult = {
		mode: "inspect",
		recordId,
		traceId: trace.traceId,
		command: trace.command,
		cwd: trace.cwd,
		startedAt: trace.startedAt,
		finishedAt: trace.finishedAt,
		durationMs: trace.durationMs,
		exitCode: trace.exitCode,
		signal: trace.signal,
		stdout: traceCapture.stdout,
		stderr: traceCapture.stderr,
		env: sanitizeEnvironment({
			...process.env,
			NOOA_DISABLE_REFLECTION: "1",
		}),
		filesTouched: trace.filesTouched,
	};

	await saveRecord(cwd, record);
	await updateTrace(cwd, trace.traceId, (current) => ({
		...current,
		links: {
			...current.links,
			recordId,
		},
	}));
	return record;
}

export async function runRecordInspect(
	input: RecordInspectInput,
): Promise<SdkResult<RecordInspectResult>> {
	if (input.action !== "inspect") {
		return {
			ok: false,
			error: sdkError("record.missing_subcommand", "Missing subcommand."),
		};
	}

	if (!input.command?.length) {
		return {
			ok: false,
			error: sdkError(
				"record.invalid_target",
				"Unsupported or missing runtime command.",
			),
		};
	}

	try {
		return {
			ok: true,
			data: await executeRecordInspect(input),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError(
				message === "trace.invalid_target"
					? "record.invalid_target"
					: "record.runtime_error",
				message === "trace.invalid_target"
					? "Unsupported or missing runtime command."
					: message,
			),
		};
	}
}
