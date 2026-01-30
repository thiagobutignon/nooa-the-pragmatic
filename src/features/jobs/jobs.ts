import { readFile } from "node:fs/promises";
import { JobProviders } from "../bridge/bridge";
import { convertMarkdownToJsonResume } from "../resume/json-resume";
import { db, type Job } from "./db";
import { calculateMatchScore } from "./matcher";

type ArbeitnowJob = {
	slug?: string;
	id?: number;
	title: string;
	company_name: string;
	url: string;
	location?: string;
	description?: string;
};

type ArbeitnowResponse = {
	data?: ArbeitnowJob[];
};

export async function searchAndMatchJobs(
	resumePath: string,
	query: string,
	providerKey: string = "arbeitnow",
) {
	// 1. Load and parse resume
	const content = await readFile(resumePath, "utf-8");
	const resume = convertMarkdownToJsonResume(content);

	const results: Job[] = [];

	// 2. Fetch from providers
	if (providerKey === "arbeitnow") {
		const provider = JobProviders.arbeitnow;
		console.error(`Searching jobs on ${providerKey}...`);
		const response = await fetch(
			`${provider.baseUrl}?search=${encodeURIComponent(query)}`,
		);
		if (response.ok) {
			const json = (await response.json()) as ArbeitnowResponse;
			const rawJobs = json.data ?? [];
			for (const rawJob of rawJobs) {
				const { score } = calculateMatchScore(
					resume,
					`${rawJob.description || ""} ${rawJob.title}`,
				);
				const job: Job = {
					provider: "arbeitnow",
					externalId: rawJob.slug || rawJob.id?.toString(),
					title: rawJob.title,
					company: rawJob.company_name,
					url: rawJob.url,
					location: rawJob.location,
					description: rawJob.description,
					matchScore: score,
					status: "saved",
					rawPayload: JSON.stringify(rawJob),
				};
				db.saveJob(job);
				results.push(job);
			}
		}
	} else if (providerKey.startsWith("github:")) {
		const repoPath = providerKey.replace("github:", "");
		const [owner, repo] = repoPath.split("/");
		if (!owner || !repo) {
			throw new Error(
				`Invalid GitHub repository format: ${repoPath}. Expected owner/repo.`,
			);
		}
		console.error(`Searching jobs on GitHub repository ${owner}/${repo}...`);
		const { fetchGitHubJobs } = await import("./github");
		const githubJobs = await fetchGitHubJobs(owner, repo);

		for (const job of githubJobs) {
			// Apply query filter if provided
			if (
				query &&
				!job.title.toLowerCase().includes(query.toLowerCase()) &&
				!job.description?.toLowerCase().includes(query.toLowerCase())
			) {
				continue;
			}

			const { score } = calculateMatchScore(
				resume,
				`${job.description || ""} ${job.title}`,
			);
			job.matchScore = score;
			db.saveJob(job);
			results.push(job);
		}
	}

	return results.sort((a, b) => b.matchScore - a.matchScore);
}

export function listJobs(status?: string) {
	return db.listJobs({ status });
}

export function applyToJob(id: number) {
	db.updateJobStatus(id, "applied");
	console.error(`Job #${id} marked as applied!`);
}
