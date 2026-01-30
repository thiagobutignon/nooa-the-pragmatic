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

export async function runJobsCommand(values: JobsValues, positionals: string[]) {
	if (values.help) {
		console.log(jobsHelp);
		return;
	}

	try {
		const { searchAndMatchJobs, listJobs, applyToJob } = await import(
			"../jobs.js"
		);

		if (values.apply) {
			applyToJob(Number.parseInt(values.apply));
			return;
		}

		if (values.list) {
			const jobs = listJobs();
			console.log("\n📋 Saved Jobs (ranked by match score):");
			for (const j of jobs) {
				console.log(
					`[ID: ${j.id}] ${Math.round(j.match_score * 100)}% - ${j.title} @ ${j.company} [${j.status}]`,
				);
				console.log(`     Link: ${j.url}\n`);
			}
			return;
		}

		const resumePath = positionals[0];
		if (!resumePath || !values.search) {
			console.error("Error: 'jobs <resume-path> --search <query>' is required.");
			process.exitCode = 1;
			return;
		}

		const providers = values.provider || ["arbeitnow"];

		if (values.cron) {
			const { scheduleJobFetch } = await import("../automation.js");
			scheduleJobFetch(
				values.cron,
				resumePath,
				values.search,
				providers,
			);
			console.error("🚀 Keep-alive for scheduled tasks. Press Ctrl+C to stop.");
			return;
		}

		for (const provider of providers) {
			await searchAndMatchJobs(resumePath, values.search, provider);
		}

		console.log(`\n✅ Done! Found matches across ${providers.length} providers.`);
		console.log("Run 'nooa jobs --list' to see all saved jobs.");
	} catch (error: any) {
		console.error("Jobs error:", error.message);
		process.exitCode = 1;
	}
}

export function printJobsHelp() {
	console.log(jobsHelp);
}
