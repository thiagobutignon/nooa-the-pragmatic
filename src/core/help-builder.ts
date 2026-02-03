import type { AgentChangelogEntry } from "./types";

export type HelpSection = {
	title: string;
	body: string;
};

export class HelpBuilder {
	private sections: HelpSection[] = [];
	private changelog: AgentChangelogEntry[] = [];
	private includeChangelog = false;

	constructor(private readonly header: string) {}

	addSection(title: string, body: string) {
		this.sections.push({ title, body });
		return this;
	}

	withChangelog(changelog: AgentChangelogEntry[]) {
		this.changelog = changelog;
		return this;
	}

	includeChangelogSection(value = true) {
		this.includeChangelog = value;
		return this;
	}

	build() {
		const lines: string[] = [];
		if (this.header.trim()) lines.push(this.header.trim());

		for (const section of this.sections) {
			lines.push(`## ${section.title}`, section.body.trim());
		}

		if (this.includeChangelog && this.changelog.length > 0) {
			lines.push("## Changelog");
			for (const entry of this.changelog) {
				lines.push(`  ${entry.version}: ${entry.changes.join("; ")}`);
			}
		}

		return lines.join("\n\n").trim();
	}
}

export function renderChangelogXml(changelog: AgentChangelogEntry[]) {
	const entries = changelog
		.map(
			(entry) =>
				`    <version number="${entry.version}">` +
				entry.changes.map((change) => `\n      <change>${change}</change>`).join("") +
				"\n    </version>",
		)
		.join("\n");

	return `<changelog>\n${entries}\n  </changelog>`;
}
