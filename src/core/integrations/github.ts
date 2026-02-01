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
            const err = await response.json();
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
            const err = await response.json();
            throw new Error(`GitHub API Error: ${err.message || response.statusText}`);
        }
        
        return response.json();
    }
}
