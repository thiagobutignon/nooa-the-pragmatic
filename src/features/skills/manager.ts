import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { skillTemplate } from "./templates";

export interface Skill {
	name: string;
	description: string;
	enabled: boolean;
	path: string;
}

export class SkillManager {
	constructor(private skillsRootDir: string) {}

	async createSkill(name: string, description: string): Promise<void> {
		const skillDir = join(this.skillsRootDir, name);
		await mkdir(skillDir, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			skillTemplate(name, description),
		);
	}

	async deleteSkill(name: string): Promise<void> {
		const skillDir = join(this.skillsRootDir, name);
		await rm(skillDir, { recursive: true, force: true });
	}

	async enableSkill(name: string): Promise<void> {
		const disabledFile = join(this.skillsRootDir, name, ".disabled");
		await rm(disabledFile, { force: true });
	}

	async disableSkill(name: string): Promise<void> {
		const disabledFile = join(this.skillsRootDir, name, ".disabled");
		await writeFile(disabledFile, "");
	}

	async updateSkill(name: string): Promise<void> {
		// Verify the skill exists
		const skillDir = join(this.skillsRootDir, name);
		await stat(skillDir);
	}

	async showSkill(
		name: string,
	): Promise<{ name: string; description: string; content: string }> {
		const skillDir = join(this.skillsRootDir, name);
		const content = await readFile(join(skillDir, "SKILL.md"), "utf-8");
		const { name: skillName, description } = this.parseFrontmatter(content);
		return { name: skillName, description, content };
	}

	async listSkills(): Promise<Skill[]> {
		try {
			const entries = await readdir(this.skillsRootDir);
			const skills: Skill[] = [];

			for (const entry of entries) {
				const skillDir = join(this.skillsRootDir, entry);
				try {
					const stats = await stat(skillDir);
					if (stats.isDirectory()) {
						const content = await readFile(
							join(skillDir, "SKILL.md"),
							"utf-8",
						).catch(() => null);
						if (content) {
							const { name, description } = this.parseFrontmatter(content);
							const disabled = await stat(join(skillDir, ".disabled"))
								.then(() => true)
								.catch(() => false);
							skills.push({
								name: name || entry,
								description: description || "",
								enabled: !disabled,
								path: skillDir,
							});
						}
					}
				} catch {
					// Ignore invalid entries
				}
			}
			return skills;
		} catch {
			return [];
		}
	}

	private parseFrontmatter(content: string): {
		name: string;
		description: string;
	} {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (match?.[1]) {
			const frontmatter = match[1];
			const nameMatch = frontmatter.match(/^name:[ \t]*(.*)$/im);
			const descMatch = frontmatter.match(/^description:[ \t]*(.*)$/im);
			return {
				name: nameMatch ? (nameMatch[1]?.trim() ?? "") : "",
				description: descMatch ? (descMatch[1]?.trim() ?? "") : "",
			};
		}
		return { name: "", description: "" };
	}
}
