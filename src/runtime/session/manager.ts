import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type SessionRole = "user" | "assistant" | "system" | "tool";

export interface Message {
	role: SessionRole;
	content: string;
	toolCallId?: string;
}

export interface Session {
	key: string;
	messages: Message[];
	summary?: string;
	created: string;
	updated: string;
}

export class SessionManager {
	private sessions = new Map<string, Session>();
	private storage: string;

	constructor(storage: string) {
		this.storage = storage;
		if (!existsSync(storage)) {
			mkdirSync(storage, { recursive: true });
		}
		this.load();
	}

	getOrCreate(key: string): Session {
		const existing = this.sessions.get(key);
		if (existing) return existing;

		const now = new Date().toISOString();
		const session: Session = {
			key,
			messages: [],
			created: now,
			updated: now,
		};
		this.sessions.set(key, session);
		return session;
	}

	addMessage(sessionKey: string, role: SessionRole, content: string): void {
		const session = this.getOrCreate(sessionKey);
		session.messages.push({ role, content });
		session.updated = new Date().toISOString();
	}

	getHistory(key: string): Message[] {
		const session = this.sessions.get(key);
		if (!session) return [];
		return [...session.messages];
	}

	getSummary(key: string): string | undefined {
		return this.sessions.get(key)?.summary;
	}

	setSummary(key: string, summary: string): void {
		const session = this.sessions.get(key);
		if (!session) return;
		session.summary = summary;
		session.updated = new Date().toISOString();
	}

	truncateHistory(key: string, keepLast: number): void {
		const session = this.sessions.get(key);
		if (!session) return;
		if (session.messages.length <= keepLast) return;
		session.messages = session.messages.slice(-keepLast);
		session.updated = new Date().toISOString();
	}

	async save(key: string): Promise<void> {
		const session = this.sessions.get(key);
		if (!session) return;

		const filename = this.safeFileName(key);
		const filepath = join(this.storage, `${filename}.json`);
		const tmpPath = `${filepath}.tmp`;
		const data = JSON.stringify(session, null, 2);

		writeFileSync(tmpPath, data, "utf-8");
		renameSync(tmpPath, filepath);
	}

	private load(): void {
		if (!existsSync(this.storage)) return;

		for (const file of readdirSync(this.storage)) {
			if (!file.endsWith(".json")) continue;
			try {
				const data = readFileSync(join(this.storage, file), "utf-8");
				const parsed = JSON.parse(data) as Session;
				if (parsed?.key && Array.isArray(parsed.messages)) {
					this.sessions.set(parsed.key, parsed);
				}
			} catch {
				// Ignore corrupted session files and continue loading others.
			}
		}
	}

	private safeFileName(key: string): string {
		return key.replace(/[^a-zA-Z0-9_-]/g, "_");
	}
}
