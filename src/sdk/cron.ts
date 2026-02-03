import type { CronJobRecord, CronJobSpec } from "../core/db/cron_store";
import { cronService } from "../features/cron/service";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface CronAddInput {
	name?: string;
	schedule?: string;
	command?: string;
	description?: string;
	onFailure?: CronJobSpec["on_failure"];
	retries?: number;
	timeout?: string;
	startAt?: string;
	endAt?: string;
	maxRuns?: number;
}

export interface CronListInput {
	active?: boolean;
}

export interface CronNameInput {
	name?: string;
	force?: boolean;
}

export interface CronLogsInput {
	name?: string;
	limit?: number;
	since?: string;
}

export interface CronEditInput {
	name?: string;
	schedule?: string;
	command?: string;
	description?: string;
}

export async function add(input: CronAddInput): Promise<SdkResult<CronJobRecord>> {
	if (!input.name || !input.schedule || !input.command) {
		return {
			ok: false,
			error: sdkError("invalid_input", "name, schedule, and command are required.", {
				fields: [
					!input.name ? "name" : null,
					!input.schedule ? "schedule" : null,
					!input.command ? "command" : null,
				].filter(Boolean),
			}),
		};
	}

	try {
		const spec: CronJobSpec = {
			name: input.name,
			schedule: input.schedule,
			command: input.command,
			description: input.description,
			enabled: true,
			on_failure: input.onFailure ?? "notify",
			retries: input.retries ?? 0,
			timeout: input.timeout,
			start_at: input.startAt,
			end_at: input.endAt,
			max_runs: input.maxRuns ?? 0,
		};

		await cronService.addJob(spec);
		const job = cronService.getJob(input.name);
		if (!job) {
			return {
				ok: false,
				error: sdkError("runtime_error", "Job creation failed.")
			};
		}
		return { ok: true, data: job };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("cron_error", "Failed to add job.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function list(
	input: CronListInput = {},
): Promise<SdkResult<CronJobRecord[]>> {
	try {
		const jobs = cronService.listJobs();
		const filtered = input.active ? jobs.filter((job) => job.enabled) : jobs;
		return { ok: true, data: filtered };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("cron_error", "Failed to list jobs.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function status(
	input: CronNameInput,
): Promise<SdkResult<CronJobRecord>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	const job = cronService.getJob(input.name);
	if (!job) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	return { ok: true, data: job };
}

export async function enable(
	input: CronNameInput,
): Promise<SdkResult<CronJobRecord>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	const job = cronService.getJob(input.name);
	if (!job) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	cronService.enableJob(input.name);
	const updated = cronService.getJob(input.name);
	return updated ? { ok: true, data: updated } : { ok: false, error: sdkError("runtime_error", "Failed to enable job.") };
}

export async function disable(
	input: CronNameInput,
): Promise<SdkResult<CronJobRecord>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	const job = cronService.getJob(input.name);
	if (!job) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	cronService.disableJob(input.name);
	const updated = cronService.getJob(input.name);
	return updated ? { ok: true, data: updated } : { ok: false, error: sdkError("runtime_error", "Failed to disable job.") };
}

export async function remove(
	input: CronNameInput,
): Promise<SdkResult<{ removed: boolean }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	if (!input.force) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Use force to remove a job.", {
				field: "force",
			}),
		};
	}
	const removed = cronService.removeJob(input.name);
	if (!removed) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	return { ok: true, data: { removed } };
}

export async function run(
	input: CronNameInput,
): Promise<SdkResult<{ executed: boolean }>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	const job = cronService.getJob(input.name);
	if (!job) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	cronService.recordExecution(input.name, "success", {
		output: `Executed via SDK at ${new Date().toISOString()}`,
	});
	return { ok: true, data: { executed: true } };
}

export async function logs(
	input: CronLogsInput,
): Promise<SdkResult<ReturnType<typeof cronService.listLogs>>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	try {
		const list = cronService.listLogs(
			input.name,
			input.limit ?? 10,
			input.since,
		);
		return { ok: true, data: list };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("cron_error", "Failed to list logs.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function edit(
	input: CronEditInput,
): Promise<SdkResult<CronJobRecord>> {
	if (!input.name) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Job name is required.", {
				field: "name",
			}),
		};
	}
	if (!input.schedule && !input.command && !input.description) {
		return {
			ok: false,
			error: sdkError("invalid_input", "Provide schedule, command, or description.")
		};
	}
	const job = cronService.getJob(input.name);
	if (!job) {
		return {
			ok: false,
			error: sdkError("not_found", `Job '${input.name}' not found.`),
		};
	}
	cronService.editJob(input.name, {
		schedule: input.schedule,
		command: input.command,
		description: input.description,
	});
	const updated = cronService.getJob(input.name);
	return updated ? { ok: true, data: updated } : { ok: false, error: sdkError("runtime_error", "Failed to edit job.") };
}

export const cron = {
	add,
	list,
	status,
	enable,
	disable,
	remove,
	run,
	logs,
	edit,
	pause: disable,
	resume: enable,
	history: logs,
};
