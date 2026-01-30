import { describe, expect, it } from "bun:test";
import type { JsonResume } from "./json-resume";
import {
	convertJsonResumeToMarkdown,
	convertMarkdownToJsonResume,
} from "./json-resume";

describe("JSON Resume Converter", () => {
	const mockMarkdown = `# John Doe
john@example.com | [LinkedIn](https://linkedin.com/in/john) | [GitHub](https://github.com/john)

Senior Developer

## EMPLOYMENT & EXPERIENCE

### Tech Co - Senior Dev - Jan 2020 - Present
Leading the team.
**Technologies and Languages:** React, Node.js
- Built cool stuff

## EDUCATION

### University of Tech - CS - 2015 - 2019

## AWARDS & ACHIEVEMENTS

#### Best Dev: won the best dev award
- Award details
`;

	it("should convert Markdown to JSON Resume struct", () => {
		const json = convertMarkdownToJsonResume(mockMarkdown);

		const basics = json.basics;
		if (!basics) {
			throw new Error("Expected basics to be defined");
		}

		expect(basics.name).toBe("John Doe");
		expect(basics.email).toBe("john@example.com");

		const profiles = basics.profiles;
		if (!profiles) {
			throw new Error("Expected profiles to be defined");
		}

		expect(profiles).toHaveLength(2);
		expect(profiles[0]?.network).toBe("LinkedIn");

		const work = json.work;
		if (!work) {
			throw new Error("Expected work to be defined");
		}

		expect(work).toHaveLength(1);
		expect(work[0]?.name).toBe("Tech Co");
		expect(work[0]?.position).toBe("Senior Dev");
		expect(work[0]?.startDate).toBe("Jan 2020");
		expect(work[0]?.keywords).toContain("React");

		const education = json.education;
		if (!education) {
			throw new Error("Expected education to be defined");
		}

		expect(education).toHaveLength(1);
		expect(education[0]?.institution).toBe("University of Tech");

		const awards = json.awards;
		if (!awards) {
			throw new Error("Expected awards to be defined");
		}

		expect(awards).toHaveLength(1);
		expect(awards[0]?.title).toBe("Best Dev");
	});

	it("should handle multi-line work summary and technologies", () => {
		const md = `
## EMPLOYMENT & EXPERIENCE

### Tech Co - Lead - 2020
This is line 1 of summary.
This is line 2 of summary.

**Technologies and Languages:** Bun, Vitest
`;
		const json = convertMarkdownToJsonResume(md);
		const work = json.work;
		if (!work) {
			throw new Error("Expected work to be defined");
		}
		expect(work[0]?.summary).toBe(
			"This is line 1 of summary.\nThis is line 2 of summary.",
		);
		expect(work[0]?.keywords).toContain("Bun");
		expect(work[0]?.keywords).toContain("Vitest");
	});

	it("should extract deeply nested highlights from Markdown", () => {
		const md = `
## EMPLOYMENT & EXPERIENCE

### NFTGenius - Founder - 2023 - Present
- Highlight 1
  - Sub-highlight A
  - Sub-highlight B
- Highlight 2
`;
		const resume = convertMarkdownToJsonResume(md);
		expect(resume.work).toHaveLength(1);
		const work = resume.work;
		if (!work) {
			throw new Error("Expected work to be defined");
		}

		expect(work[0]?.highlights).toHaveLength(2);
		// marked parses nested list items with their prefix on a new line
		expect(work[0]?.highlights?.[0]).toMatch(
			/Highlight 1\n- Sub-highlight A\n- Sub-highlight B/,
		);
		expect(work[0]?.highlights).toContain("Highlight 2");
	});

	it("should extract awards and skills sections from Markdown", () => {
		const md = `
## AWARDS & ACHIEVEMENTS

### 1st Place: Angelhack – 2016
OmniPay solution

## SKILLS

### Languages
**Keywords:** Typescript, Javascript.
            `;

		const resume = convertMarkdownToJsonResume(md);
		expect(resume.awards).toHaveLength(1);
		const awards = resume.awards;
		if (!awards) {
			throw new Error("Expected awards to be defined");
		}
		expect(awards[0]?.title).toBe("1st Place: Angelhack");
		expect(awards[0]?.date).toBe("2016");
		expect(awards[0]?.summary).toBe("OmniPay solution");

		expect(resume.skills).toHaveLength(1);
		const skills = resume.skills;
		if (!skills) {
			throw new Error("Expected skills to be defined");
		}
		expect(skills[0]?.name).toBe("Languages");
		expect(skills[0]?.keywords).toContain("Typescript");
		expect(skills[0]?.keywords).toContain("Javascript");
	});

	it("should convert JSON Resume to Markdown", () => {
		const json: JsonResume = {
			basics: {
				name: "Jane Doe",
				email: "jane@example.com",
				summary: "Experienced Dev",
				profiles: [{ network: "GitHub", url: "https://github.com/jane" }],
			},
			work: [
				{
					name: "Company A",
					position: "Lead",
					startDate: "2021",
					endDate: "Present",
					summary: "Did good work",
					highlights: ["Fixed bugs", "Technologies: Rust, Go"],
				},
			],
			awards: [
				{
					title: "Hackathon Winner",
					summary: "First place",
				},
			],
		};

		const markdown = convertJsonResumeToMarkdown(json);

		expect(markdown).toContain("# Jane Doe");
		expect(markdown).toContain("<jane@example.com>");
		expect(markdown).toContain("[GitHub](https://github.com/jane)");
		expect(markdown).toContain("## EMPLOYMENT & EXPERIENCE");
		expect(markdown).toContain("### Company A - Lead - 2021 - Present");
		expect(markdown).toContain("Did good work");
		expect(markdown).toContain("**Technologies and Languages:** Rust, Go");
		expect(markdown).toContain("## AWARDS & ACHIEVEMENTS");
		expect(markdown).toContain("#### Hackathon Winner");
	});

	it("should handle round trip (roughly)", () => {
		// Note: Formatting might change slightly (whitespaces), but semantic content should remain
		const json = convertMarkdownToJsonResume(mockMarkdown);
		const md = convertJsonResumeToMarkdown(json);
		const json2 = convertMarkdownToJsonResume(md);

		expect(json2.basics?.name).toBe(json.basics?.name);
		expect(json2.work?.length).toBe(json.work?.length);
	});

	it("should handle comprehensive resume features (WhatsApp, unknown sections, multiline summary)", () => {
		const complexMarkdown = `# Jane Doe
<jane@example.com> | [Whatsapp](https://wa.me/123456)

## UNKNOWN SECTION

### Some Header

## EMPLOYMENT & EXPERIENCE

### Work Place - Dev - 2022
First line of summary.
Second line of summary.

**Technologies and Languages:** TS, JS
`;
		const json = convertMarkdownToJsonResume(complexMarkdown);

		const basics = json.basics;
		if (!basics || !basics.profiles) {
			throw new Error("Expected basics profiles to be defined");
		}
		expect(basics.profiles.find((p) => p.network === "Whatsapp")).toBeDefined();

		// precise multiline summary check
		const work = json.work;
		if (!work) {
			throw new Error("Expected work to be defined");
		}
		expect(work[0]?.summary).toBe(
			"First line of summary.\nSecond line of summary.",
		);

		// Unknown section shouldn't crash or pollute
		expect(json.work).toHaveLength(1);
	});
});
