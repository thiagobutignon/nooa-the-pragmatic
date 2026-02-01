// src/core/integrations/github.ts
export class GitHubClient {
    constructor(private token: string) {}

    async createPR(owner: string, repo: string, head: string, base: string, title: string, body: string) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                "User-Agent": "nooa-cli"
            },
            body: JSON.stringify({ title, body, head, base })
        });
        
        if (!response.ok) {
            const err = (await response.json()) as any;
            throw new Error(`GitHub API Error: ${err.message || response.statusText}`);
        }
        
        return response.json();
    }

    async listPRs(owner: string, repo: string) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            headers: { 
                Authorization: `Bearer ${this.token}`,
                "User-Agent": "nooa-cli"
            }
        });
        
        if (!response.ok) {
            const err = (await response.json()) as any;
            throw new Error(`GitHub API Error: ${err.message || response.statusText}`);
        }
        
        return response.json();
    }

    async getPRDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
            headers: { 
                Authorization: `Bearer ${this.token}`,
                "User-Agent": "nooa-cli",
                "Accept": "application/vnd.github.v3.diff"
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API Error: Failed to fetch PR diff (${response.statusText})`);
        }
        
        return response.text();
    }
}
