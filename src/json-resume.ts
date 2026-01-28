import { lexer, type Tokens } from "marked";

export interface JsonResume {
	basics?: Basics;
	work?: Work[];
	education?: Education[];
	awards?: Award[];
	skills?: Skill[];
}

export interface Basics {
	name?: string;
	label?: string;
	image?: string;
	email?: string;
	phone?: string;
	url?: string;
	summary?: string;
	location?: Location;
	profiles?: Profile[];
}

export interface Location {
	address?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
	region?: string;
}

export interface Profile {
	network: string;
	username?: string;
	url?: string;
}

export interface Work {
	name?: string;
	position?: string;
	url?: string;
	startDate?: string;
	endDate?: string;
	summary?: string;
	highlights?: string[];
	keywords?: string[];
}

export interface Education {
	institution?: string;
	url?: string;
	area?: string;
	studyType?: string;
	startDate?: string;
	endDate?: string;
	score?: string;
	courses?: string[];
}

export interface Award {
	title?: string;
	date?: string;
	awarder?: string;
	summary?: string;
}

export interface Skill {
	name?: string;
	level?: string;
	keywords?: string[];
}

function parseContactInfo(text: string, resume: JsonResume) {
	const parts = text.split("|").map((s) => s.trim());
	if (!resume.basics) resolveBasics(resume);
	const basics = resume.basics as NonNullable<typeof resume.basics>;

	for (const part of parts) {
		if (part.includes("@")) {
			basics.email = part.replace(/[<>]/g, "");
		} else if (part.match(/\d+/) && !part.includes("http")) {
			// Basic phone check (digits and not url)
			// But wait, whatsapp link has digits.
			// Assume phone is mostly digits and separators
			basics.phone = part;
		} else if (part.toLowerCase().includes("linkedin")) {
			basics.profiles = basics.profiles || [];
			basics.profiles.push({
				network: "LinkedIn",
				url: extractLink(part),
			});
		} else if (part.toLowerCase().includes("github")) {
			basics.profiles = basics.profiles || [];
			basics.profiles.push({
				network: "GitHub",
				url: extractLink(part),
			});
		} else if (part.toLowerCase().includes("whatsapp")) {
			basics.profiles = basics.profiles || [];
			basics.profiles.push({
				network: "Whatsapp",
				url: extractLink(part),
			});
		}
	}
}

function resolveBasics(resume: JsonResume) {
	resume.basics = resume.basics || {};
}

function extractLink(text: string): string | undefined {
	const match = text.match(/\((.*?)\)/);
	return match ? match[1] : undefined;
}

export function convertMarkdownToJsonResume(markdown: string): JsonResume {
	const tokens = lexer(markdown);
	const resume: JsonResume = {
		basics: {},
		work: [],
		education: [],
		awards: [],
		skills: [],
	};

	let currentSection:
		| "basics"
		| "work"
		| "education"
		| "awards"
		| "skills"
		| null = "basics";
	let currentWork: Work | null = null;
	let currentEdu: Education | null = null;

	for (const token of tokens) {
		// console.log('TOKEN:', token.type); // Debug if needed

		if (token.type === "heading") {
			const h = token as Tokens.Heading;
			if (h.depth === 1) {
				resume.basics = resume.basics || {};
				resume.basics.name = h.text;
				continue;
			}

			if (h.depth === 2) {
				const sectionTitle = h.text.toUpperCase();
				if (
					sectionTitle.includes("EXPERIENCE") ||
					sectionTitle.includes("EMPLOYMENT")
				) {
					currentSection = "work";
				} else if (sectionTitle.includes("EDUCATION")) {
					currentSection = "education";
				} else if (sectionTitle.includes("AWARDS")) {
					currentSection = "awards";
				} else {
					currentSection = null;
				}
				continue;
			}

			if (h.depth === 3 && currentSection === "work") {
				const parts = h.text.split(" - ").map((s) => s.trim());
				currentWork = {
					name: parts[0],
					position: parts[1],
					startDate: parts[2],
					highlights: [],
				};
				resume.work = resume.work || [];
				resume.work.push(currentWork);
				continue;
			}

			if (h.depth === 3 && currentSection === "education") {
				const parts = h.text.split(" - ").map((s) => s.trim());
				currentEdu = {
					institution: parts[0],
					area: parts[1],
					startDate: parts[2],
				};
				resume.education = resume.education || [];
				resume.education.push(currentEdu);
				continue;
			}

			if (h.depth === 4 && currentSection === "awards") {
				const parts = h.text.split(":").map((s) => s.trim());
				resume.awards = resume.awards || [];
				resume.awards.push({
					title: parts[0],
					summary: parts[1] || "",
				});
				continue;
			}
		}

		// Handle basic contact info which might be parsed as Paragraph OR Table (due to pipes)
		if (currentSection === "basics") {
			if (token.type === "paragraph") {
				const p = token as Tokens.Paragraph;
				if (p.text.includes("@") || p.text.includes("|")) {
					parseContactInfo(p.text, resume);
					continue; // Handled as contact
				} else if (resume.basics?.name && !resume.basics.summary) {
					resume.basics.summary = p.text;
				}
			} else if (token.type === "table") {
				const t = token as Tokens.Table;
				// Join all cells to reconstruct the line
				const parts: string[] = [];
				t.header.forEach((h) => {
					parts.push(h.text);
				});
				t.rows.forEach((r) => {
					r.forEach((c) => {
						parts.push(c.text);
					});
				});
				parseContactInfo(parts.join(" | "), resume);
				continue;
			}
		}

		if (token.type === "paragraph") {
			const p = token as Tokens.Paragraph;

			if (currentSection === "work" && currentWork) {
				const lines = p.text.split("\n");
				for (const line of lines) {
					if (line.trim().startsWith("**Technologies and Languages:**")) {
						const techs = line
							.replace("**Technologies and Languages:**", "")
							.trim();
						currentWork.keywords = currentWork.keywords || [];
						const keywords = techs.split(",").map((k) => k.trim());
						currentWork.keywords.push(...keywords);

						currentWork.highlights = currentWork.highlights || [];
						currentWork.highlights.push(`Technologies: ${techs}`);
					} else {
						if (!currentWork.summary) {
							currentWork.summary = line;
						} else {
							currentWork.summary += `\n${line}`;
						}
					}
				}
			}
		}

		if (token.type === "list" && currentSection === "work" && currentWork) {
			const list = token as Tokens.List;
			for (const item of list.items) {
				currentWork.highlights = currentWork.highlights || [];
				currentWork.highlights.push(item.text);
			}
		}

		if (token.type === "list" && currentSection === "awards") {
			const list = token as Tokens.List;
			const lastAward =
				resume.awards && resume.awards.length > 0
					? resume.awards[resume.awards.length - 1]
					: null;
			if (lastAward) {
				list.items.forEach((item) => {
					lastAward.summary =
						(lastAward.summary ? `${lastAward.summary}; ` : "") + item.text;
				});
			}
		}
	}

	return resume;
}

export function convertJsonResumeToMarkdown(resume: JsonResume): string {
	const lines: string[] = [];
	if (resume.basics) {
		if (resume.basics.name) lines.push(`# ${resume.basics.name}`);
		const contacts: string[] = [];
		if (resume.basics.email) contacts.push(`<${resume.basics.email}>`);
		resume.basics.profiles?.forEach((p) => {
			if (p.url) contacts.push(`[${p.network}](${p.url})`);
		});
		if (resume.basics.phone) contacts.push(resume.basics.phone);
		if (resume.basics.location?.city)
			contacts.push(
				`${resume.basics.location.city}, ${resume.basics.location.countryCode || ""}`,
			);
		if (contacts.length > 0) lines.push(contacts.join(" | "));
		lines.push("");
		if (resume.basics.summary) {
			lines.push(resume.basics.summary);
			lines.push("");
		}
	}
	if (resume.work && resume.work.length > 0) {
		lines.push("## EMPLOYMENT & EXPERIENCE");
		lines.push("");
		resume.work.forEach((job) => {
			const date = job.startDate
				? `${job.startDate}${job.endDate ? ` - ${job.endDate}` : ""}`
				: "";
			const header = [job.name, job.position, date].filter(Boolean).join(" - ");
			lines.push(`### ${header}`);
			if (job.summary) {
				lines.push(job.summary);
				lines.push("");
			}
			if (job.highlights && job.highlights.length > 0) {
				job.highlights.forEach((h) => {
					if (h.startsWith("Technologies:")) {
						const content = h.replace("Technologies:", "").trim();
						lines.push(`**Technologies and Languages:** ${content}`);
					} else {
						lines.push(`- ${h}`);
					}
				});
				lines.push("");
			}
		});
	}
	if (resume.education && resume.education.length > 0) {
		lines.push("## EDUCATION");
		lines.push("");
		resume.education.forEach((edu) => {
			const date = edu.startDate
				? `${edu.startDate}${edu.endDate ? ` - ${edu.endDate}` : ""}`
				: "";
			const headerParts = [edu.institution, edu.area, date].filter(Boolean);
			lines.push(`### ${headerParts.join(" - ")}`);
			lines.push("");
		});
	}
	if (resume.awards && resume.awards.length > 0) {
		lines.push("## AWARDS & ACHIEVEMENTS");
		lines.push("");
		resume.awards.forEach((award) => {
			lines.push(`#### ${award.title}`);
			if (award.summary) {
				const items = award.summary
					.split(";")
					.map((s) => s.trim())
					.filter(Boolean);
				for (const i of items) {
					lines.push(`- ${i}`);
				}
			}
			lines.push("");
		});
	}
	return lines.join("\n");
}
