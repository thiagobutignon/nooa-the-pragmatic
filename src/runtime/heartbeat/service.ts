import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_TEMPLATE = `# Periodic Tasks

- Check inbox and urgent notifications.
- Check next 24h calendar events.
- Summarize meaningful project updates.
- If nothing needs attention, return HEARTBEAT_OK.
`;

export class HeartbeatService {
	constructor(private readonly workspace: string) {}

	private get heartbeatPath(): string {
		return join(this.workspace, ".nooa", "HEARTBEAT.md");
	}

	async readHeartbeat(): Promise<string> {
		try {
			return await readFile(this.heartbeatPath, "utf8");
		} catch {
			return "";
		}
	}

	async ensureTemplate(): Promise<void> {
		try {
			await access(this.heartbeatPath, constants.F_OK);
			return;
		} catch {
			await mkdir(join(this.workspace, ".nooa"), { recursive: true });
			await writeFile(this.heartbeatPath, DEFAULT_TEMPLATE, "utf8");
		}
	}

	async buildPrompt(): Promise<string> {
		const content = await this.readHeartbeat();
		const now = new Date().toISOString();
		const heartbeatBody =
			content.trim().length > 0 ? content.trim() : "(empty)";
		return `Current time: ${now}\n\nHEARTBEAT.md:\n${heartbeatBody}`;
	}
}
