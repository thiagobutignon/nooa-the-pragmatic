import { beforeAll, describe, expect, it, mock } from "bun:test";

mock.module("pdf-parse", () => {
	return {
		PDFParse: class {
			data: Uint8Array;
			constructor(options: { data: Uint8Array }) {
				this.data = options.data;
			}
			async getText() {
				return { text: this.data.toString() };
			}
			async destroy() {}
		},
	};
});

let convertPdfToMarkdown: typeof import("./converter").convertPdfToMarkdown;

beforeAll(async () => {
	({ convertPdfToMarkdown } = await import("./converter"));
});

describe("convertPdfToMarkdown", () => {
	it("should promote first line to H1", async () => {
		const input = "Thiago Butignon\nSoftware Engineer";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("# Thiago Butignon");
		expect(result).toContain("Software Engineer");
	});

	it("should detect contact info and link user handles", async () => {
		const input = "Name\nemail@example.com | LinkedIn | GitHub | Whatsapp";
		const result = await convertPdfToMarkdown(Buffer.from(input));

		expect(result).toContain("<email@example.com>");
		expect(result).toContain(
			"[LinkedIn](https://linkedin.com/in/thiagobutignon)",
		);
		expect(result).toContain("[GitHub](https://github.com/thiagobutignon)");
		expect(result).toContain("[Whatsapp](http://wa.me/5511994899288)");
	});

	it("should use custom social links when provided (WhatsApp number)", async () => {
		const input = "Name\nemail@example.com | LinkedIn | GitHub | Whatsapp";
		const result = await convertPdfToMarkdown(Buffer.from(input), {
			linkedin: "https://linkedin.com/in/custom",
			github: "https://github.com/custom",
			whatsapp: "123456789",
		});

		expect(result).toContain("[LinkedIn](https://linkedin.com/in/custom)");
		expect(result).toContain("[GitHub](https://github.com/custom)");
		expect(result).toContain("[Whatsapp](http://wa.me/123456789)");
	});

	it("should use custom social links when provided (WhatsApp URL)", async () => {
		const input = "Name\nemail@example.com | LinkedIn | GitHub | Whatsapp";
		const result = await convertPdfToMarkdown(Buffer.from(input), {
			whatsapp: "https://wa.me/987654321",
		});

		expect(result).toContain("[Whatsapp](https://wa.me/987654321)");
	});

	it("should promote ALL CAPS lines to H2", async () => {
		const input = "Header\nEXPERIENCE\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("## EXPERIENCE");
	});

	it("should promote Job Titles (with date) to H3", async () => {
		const input = "Header\nCompany - Role - 2024\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("### Company - Role - 2024");
	});

	it("should format Lists", async () => {
		const input = "Header\n- Item 1\n• Item 2\n* Item 3";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("- Item 1");
		expect(result).toContain("- Item 2");
		expect(result).toContain("- Item 3");
	});

	it("should format Technologies and Languages", async () => {
		const input = "Header\nTechnologies and Languages: TypeScript, Rust";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain(
			"**Technologies and Languages:** TypeScript, Rust",
		);
	});

	it("should format Awards (1st/2nd/3rd Place/Finalist) as H4", async () => {
		const input = "Header\n1st Place: Hackathon\nFinalist at: Competition";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("#### 1st Place: Hackathon");
		expect(result).toContain("#### Finalist at: Competition");
	});

	it("should NOT promote mixed case to H2", async () => {
		const input = "Header\nMixed Case Line\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("## Mixed Case Line");
	});

	it("should NOT promote bulleted lines to H3 even if they have dates", async () => {
		const input = "Header\n- Company - Role - 2024\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("### - Company");
		expect(result).toContain("- Company - Role - 2024");
	});

	it("should handle Award as the first non-empty line", async () => {
		const input = "1st Place: Award Name";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("# 1st Place: Award Name");
	});

	it("should ignore short ALL CAPS lines", async () => {
		const input = "Header\nAB\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("## AB");
	});

	it("should NOT promote lines without dates to H3", async () => {
		const input = "Header\nCompany - Role\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("### Company");
	});

	it("should NOT promote lines without separators to H3", async () => {
		const input = "Header\nCompany Role 2024\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("### Company");
	});

	it("should handle completely empty input", async () => {
		const result = await convertPdfToMarkdown(Buffer.from(""));
		expect(result).toBe("");
	});

	it("should NOT push extra newlines if already on an empty line (H2, H3, Tech, Awards)", async () => {
		const input =
			"Name\n\nEXPERIENCE\n\nCompany - Role - 2024\n\nTechnologies and Languages: Rust\n\n1st Place: Hackathon";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("\n\n\n");
		expect(result).toContain("## EXPERIENCE");
		expect(result).toContain("### Company");
		expect(result).toContain("**Technologies and Languages:**");
		expect(result).toContain("#### 1st Place");
	});

	it("should skip page numbers", async () => {
		const input = "Name\n-- 1 of 2 --\nDetails";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).not.toContain("-- 1 of 2 --");
		expect(result).toContain("# Name");
		expect(result).toContain("Details");
	});

	it("should preserve structure (empty lines)", async () => {
		const input = "Line 1\n\nLine 2";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toMatch(/Line 1\n\nLine 2/);
	});

	it("should clean up carriage returns", async () => {
		const input = "Line 1\r\nLine 2";
		const result = await convertPdfToMarkdown(Buffer.from(input));
		expect(result).toContain("Line 1");
		expect(result).toContain("Line 2");
	});
});
