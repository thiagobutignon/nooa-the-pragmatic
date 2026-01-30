import { searchAndMatchJobs } from "./jobs";

export function scheduleJobFetch(
	cronExpression: string,
	resumePath: string,
	query: string,
	providers: string[],
) {
	console.error(`📅 Scheduling job fetch with cron: "${cronExpression}"`);
	console.error(`   Query: "${query}"`);
	console.error(`   Providers: ${providers.join(", ")}`);

	// @ts-expect-error - Bun.cron might not be in types yet depending on version
	Bun.cron(cronExpression, async () => {
		console.error(
			`\n🕒 [${new Date().toISOString()}] Starting scheduled job fetch...`,
		);
		for (const provider of providers) {
			try {
				const matches = await searchAndMatchJobs(resumePath, query, provider);
				console.error(`   ✅ [${provider}] Found ${matches.length} matches.`);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`   ❌ [${provider}] Error: ${message}`);
			}
		}
	});
}
