import type { Job } from "./db";

export interface GitHubJob {
    id: number;
    title: string;
    body: string;
    html_url: string;
    created_at: string;
    labels: { name: string }[];
}

export async function fetchGitHubJobs(owner: string, repo: string): Promise<Job[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&sort=created&direction=desc`;

    // In a real scenario, we might need a GITHUB_TOKEN for higher rate limits.
    const headers: Record<string, string> = {
        "User-Agent": "nooa-the-pragmatic",
        "Accept": "application/vnd.github.v3+json"
    };

    if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch GitHub jobs from ${owner}/${repo}: ${response.statusText}`);
    }

    const issues = (await response.json()) as GitHubJob[];

    return issues.map(issue => ({
        provider: `github:${owner}/${repo}`,
        externalId: issue.id.toString(),
        title: issue.title,
        company: "GitHub Community", // Companies are usually in the title/body
        url: issue.html_url,
        location: issue.labels.map(l => l.name).join(", "),
        description: issue.body,
        matchScore: 0, // Will be calculated by controller
        status: "saved",
        rawPayload: JSON.stringify(issue)
    }));
}
