export class GitHubClient {
	constructor(private token: string) {}

	private async requestJson(url: string, init?: RequestInit) {
		const response = await fetch(url, init);
		if (!response.ok) {
			let message = response.statusText;
			try {
				const err = (await response.json()) as { message?: string };
				message = err.message || message;
			} catch {
				// ignore parse errors
			}
			throw new Error(`GitHub API Error: ${message}`);
		}
		return response.json();
	}

	async createPR(
		owner: string,
		repo: string,
		head: string,
		base: string,
		title: string,
		body: string,
	) {
		return this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.token}`,
					"Content-Type": "application/json",
					"User-Agent": "nooa-cli",
				},
				body: JSON.stringify({ title, body, head, base }),
			},
		);
	}

	async listPRs(owner: string, repo: string) {
		return this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls`,
			{
				headers: {
					Authorization: `Bearer ${this.token}`,
					"User-Agent": "nooa-cli",
				},
			},
		);
	}

	async getPRDiff(
		owner: string,
		repo: string,
		pullNumber: number,
	): Promise<string> {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
			{
				headers: {
					Authorization: `Bearer ${this.token}`,
					"User-Agent": "nooa-cli",
					Accept: "application/vnd.github.v3.diff",
				},
			},
		);

		if (!response.ok) {
			throw new Error(
				`GitHub API Error: Failed to fetch PR diff (${response.statusText})`,
			);
		}

		return response.text();
	}

	async mergePR(
		owner: string,
		repo: string,
		pullNumber: number,
		options: {
			method?: "merge" | "squash" | "rebase";
			title?: string;
			message?: string;
		} = {},
	) {
		return this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${this.token}`,
					"Content-Type": "application/json",
					"User-Agent": "nooa-cli",
				},
				body: JSON.stringify({
					merge_method: options.method || "merge",
					commit_title: options.title,
					commit_message: options.message,
				}),
			},
		);
	}

	async closePR(owner: string, repo: string, pullNumber: number) {
		return this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${this.token}`,
					"Content-Type": "application/json",
					"User-Agent": "nooa-cli",
				},
				body: JSON.stringify({ state: "closed" }),
			},
		);
	}

	async commentPR(
		owner: string,
		repo: string,
		pullNumber: number,
		body: string,
	) {
		return this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.token}`,
					"Content-Type": "application/json",
					"User-Agent": "nooa-cli",
				},
				body: JSON.stringify({ body }),
			},
		);
	}

	async getPRStatus(owner: string, repo: string, pullNumber: number) {
		const pr = (await this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
			{
				headers: {
					Authorization: `Bearer ${this.token}`,
					"User-Agent": "nooa-cli",
				},
			},
		)) as {
			number?: number;
			title?: string;
			state?: string;
			labels?: Array<{ name?: string }>;
			head?: { sha?: string };
		};

		const labels: string[] = Array.isArray(pr.labels)
			? pr.labels
					.map((label) => label.name)
					.filter((name): name is string => Boolean(name))
			: [];

		const reviews = (await this.requestJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
			{
				headers: {
					Authorization: `Bearer ${this.token}`,
					"User-Agent": "nooa-cli",
				},
			},
		)) as Array<{ state?: string }>;

		const approvals = Array.isArray(reviews)
			? reviews.filter((review) => review.state === "APPROVED").length
			: 0;

		const sha = pr?.head?.sha;
		const checks = { total: 0, passed: 0, failed: 0, neutral: 0, skipped: 0 };
		if (sha) {
			const checkRuns = await this.requestJson(
				`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`,
				{
					headers: {
						Authorization: `Bearer ${this.token}`,
						"User-Agent": "nooa-cli",
						Accept: "application/vnd.github+json",
					},
				},
			);
			const runs = Array.isArray(checkRuns.check_runs)
				? checkRuns.check_runs
				: [];
			checks.total = runs.length;
			for (const run of runs) {
				const conclusion = run.conclusion || "neutral";
				if (conclusion === "success") checks.passed += 1;
				else if (
					conclusion === "failure" ||
					conclusion === "cancelled" ||
					conclusion === "timed_out"
				)
					checks.failed += 1;
				else if (conclusion === "skipped") checks.skipped += 1;
				else checks.neutral += 1;
			}
		}

		return {
			number: pr.number,
			title: pr.title,
			state: pr.state,
			labels,
			approvals,
			checks,
		};
	}
}
