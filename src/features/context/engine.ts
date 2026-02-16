import { execa } from "execa";
import { Store } from "../../core/db/index";
import { DEFAULT_MIN_SCORE } from "../index/execute";

export type GitState = { branch: string; summary: string };
export type EnvState = { cwd: string; os: string };
export type MemoryMatch = {
	text: string;
	score: number;
	embedding: Float32Array;
};

export class ContextEngine {
	async getGitState(root: string): Promise<GitState | null> {
		try {
			const { stdout: branch } = await execa(
				"git",
				["rev-parse", "--abbrev-ref", "HEAD"],
				{ cwd: root },
			);
			const { stdout: status } = await execa("git", ["status", "--short"], {
				cwd: root,
			});
			const changes = status.split("\n").filter(Boolean).length;
			return {
				branch: branch.trim(),
				summary: changes === 0 ? "clean" : `${changes} files changed`,
			};
		} catch {
			return null;
		}
	}

	async getEnvState(root: string): Promise<EnvState | null> {
		try {
			return { cwd: root, os: process.platform };
		} catch {
			return null;
		}
	}

	async searchMemories(
		taskEmbedding: Float32Array,
		options: { limit?: number; minScore?: number } = {},
	): Promise<MemoryMatch[]> {
		const store = new Store();
		const limit = options.limit ?? 10;
		const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
		try {
			const results = await store.searchEmbeddings(
				Array.from(taskEmbedding),
				limit,
			);
			return results
				.filter((row) => row.score >= minScore)
				.map((row) => ({
					text: row.chunk,
					score: row.score,
					embedding: new Float32Array(
						row.vector.buffer,
						row.vector.byteOffset,
						row.vector.byteLength / 4,
					),
				}));
		} finally {
			store.close();
		}
	}
}
