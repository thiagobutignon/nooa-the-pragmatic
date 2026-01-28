import { describe, expect, it } from "vitest";
import type { JsonResume } from "../src/json-resume";
import {
	convertJsonResumeToMarkdown,
	convertMarkdownToJsonResume,
} from "../src/json-resume";

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

		expect(json.basics?.name).toBe("John Doe");
		expect(json.basics?.email).toBe("john@example.com");
		expect(json.basics?.profiles).toHaveLength(2);
		expect(json.basics?.profiles?.[0].network).toBe("LinkedIn");

		expect(json.work).toHaveLength(1);
		expect(json.work?.[0].name).toBe("Tech Co");
		expect(json.work?.[0].position).toBe("Senior Dev");
		expect(json.work?.[0].startDate).toBe("Jan 2020");
		expect(json.work?.[0].keywords).toContain("React");

		expect(json.education).toHaveLength(1);
		expect(json.education?.[0].institution).toBe("University of Tech");

		expect(json.awards).toHaveLength(1);
		expect(json.awards?.[0].title).toBe("Best Dev");
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

		expect(
			json.basics?.profiles?.find((p) => p.network === "Whatsapp"),
		).toBeDefined();

		// precise multiline summary check
		expect(json.work?.[0].summary).toBe(
			"First line of summary.\nSecond line of summary.",
		);

		// Unknown section shouldn't crash or pollute
		expect(json.work).toHaveLength(1);
	});
});
