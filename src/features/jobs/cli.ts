import type { EventBus } from "../../core/event-bus";
import type { Command, CommandContext } from "../../core/command";

const jobsHelp = `
Usage: nooa jobs <resume-path> [flags]

Arguments:
  <resume-path>    Path to the resume Markdown/PDF file.

Flags:
  -s, --search <q>   Search query for jobs.
  --provider <key>   Job board provider (default: arbeitnow).
  -l, --list         List saved jobs from database.
  --apply <id>       Mark a saved job as applied.
  --cron <expr>      Schedule periodic fetch (e.g., "0 * * * *").
  -h, --help         Show help.
`;

type JobsValues = {
	search?: string;
	provider?: string[];
	apply?: string;
	cron?: string;
	list?: boolean;
	help?: boolean;
};

const jobsCommand: Command = {
	name: "jobs",
	description: "Search for jobs and match against your resume",
	execute: async ({ args, values, bus }: CommandContext) => {
		const jobsValues = values as JobsValues;
		if (jobsValues.help) {
			console.log(jobsHelp);
			return;
		}

		try {
			const { searchAndMatchJobs, listJobs, applyToJob } = await import(
				"./jobs.js"
			);

			if (jobsValues.apply) {
				applyToJob(Number.parseInt(jobsValues.apply, 10));
				bus?.emit("jobs.applied", {
					command: "jobs",
					status: "ok",
					metadata: { id: jobsValues.apply },
				});
				return;
			}

			if (jobsValues.list) {
				const jobs = listJobs() as any[];
				console.log("\n📋 Saved Jobs (ranked by match score):");
				for (const j of jobs) {
					console.log(
						`[ID: ${j.id}] ${Math.round((j.match_score || 0) * 100)}% - ${j.title} @ ${j.company} [${j.status}]`,
					);
					console.log(`     Link: ${j.url}\n`);
				}
				return;
			}

			// Subcommand 'jobs' is args[0], resumePath is args[1]
			const resumePath = args[1];
			if (!resumePath || !jobsValues.search) {
				console.error(
					"Error: 'jobs <resume-path> --search <query>' is required.",
				);
				bus?.emit("cli.error", {
					command: "jobs",
					status: "error",
					error: {
						code: "MISSING_INPUT",
						message: "jobs <resume-path> --search <query> is required",
					},
				});
				process.exitCode = 1;
				return;
			}

			const providers = jobsValues.provider || ["arbeitnow"];

			if (jobsValues.cron) {
				const { scheduleJobFetch } = await import("./automation.js");
				scheduleJobFetch(jobsValues.cron, resumePath, jobsValues.search, providers);
				console.error("🚀 Keep-alive for scheduled tasks. Press Ctrl+C to stop.");
				bus?.emit("jobs.saved", {
					command: "jobs",
					status: "ok",
					metadata: { cron: jobsValues.cron },
				});
				return;
			}

			for (const provider of providers) {
				await searchAndMatchJobs(resumePath, jobsValues.search, provider);
			}

			console.log(
				`\n✅ Done! Found matches across ${providers.length} providers.`,
			);
			console.log("Run 'nooa jobs --list' to see all saved jobs.");
			bus?.emit("jobs.matched", {
				command: "jobs",
				status: "ok",
				metadata: { providers, query: jobsValues.search },
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Jobs error:", message);
			bus?.emit("cli.error", {
				command: "jobs",
				status: "error",
				error: { code: "EXCEPTION", message },
			});
			process.exitCode = 1;
		}
	},
};

export default jobsCommand;

export async function runJobsCommand(
	values: JobsValues,
	positionals: string[],
	bus?: EventBus,
) {
	await jobsCommand.execute({ args: ["jobs", ...positionals], values, bus } as any);
}

export function printJobsHelp() {
	console.log(jobsHelp);
}
