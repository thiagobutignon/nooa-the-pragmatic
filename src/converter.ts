import { PDFParse } from "pdf-parse";

export interface ConverterOptions {
	linkedin?: string;
	github?: string;
	whatsapp?: string;
}

export async function convertPdfToMarkdown(
	buffer: Buffer,
	options: ConverterOptions = {},
): Promise<string> {
	const parser = new PDFParse({ data: buffer });
	try {
		const result = await parser.getText();
		let rawText = result.text;

		// Normalize newlines
		rawText = rawText.replace(/\r\n/g, "\n");

		// Split into lines, keeping empty lines for structure detection
		const lines = rawText.split("\n");

		const markdownLines: string[] = [];
		const pageNumberRegex = /-- \d+ of \d+ --/;

		// Heuristic 1: First non-empty line is likely the Name -> H1
		let nameFound = false;

		for (let i = 0; i < lines.length; i++) {
			const rawLine = lines[i];
			if (rawLine === undefined) continue;
			let line = rawLine.trim();

			// Preserve empty lines (structure)
			if (line.length === 0) {
				if (
					markdownLines.length > 0 &&
					markdownLines[markdownLines.length - 1] !== ""
				) {
					markdownLines.push("");
				}
				continue;
			}

			// Skip page numbers
			if (pageNumberRegex.test(line)) continue;

			if (!nameFound) {
				markdownLines.push(`# ${line}`);
				nameFound = true;
				continue;
			}

			// Heuristic: Contact Info Line (contains email or phone or | separators)
			// Attempt to auto-link email and specific social accounts (recovered via strings analysis)
			if (line.includes("@") && line.includes("|")) {
				line = line.replace(
					/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
					"<$1>",
				);

				// Inject links (provided via options or defaults)
				const linkedin =
					options.linkedin || "https://linkedin.com/in/thiagobutignon";
				const github = options.github || "https://github.com/thiagobutignon";
				const whatsapp = options.whatsapp || "5511994899288";
				const whatsappUrl = whatsapp.startsWith("http")
					? whatsapp
					: `http://wa.me/${whatsapp.replace(/\D/g, "")}`;

				line = line.replace(/LinkedIn/g, `[LinkedIn](${linkedin})`);
				line = line.replace(/GitHub/g, `[GitHub](${github})`);
				line = line.replace(/Whatsapp/g, `[Whatsapp](${whatsappUrl})`);

				markdownLines.push(line);
				continue;
			}

			// Heuristic 2: ALL CAPS lines (likely Section Headers) -> H2
			if (isLikelySectionHeader(line)) {
				if (markdownLines[markdownLines.length - 1] !== "") {
					markdownLines.push("");
				}
				markdownLines.push(`## ${line}`);
				continue;
			}

			// Heuristic 4: Job Titles / Sub-headers -> H3
			if (isLikelyJobTitle(line)) {
				if (markdownLines[markdownLines.length - 1] !== "") {
					markdownLines.push("");
				}
				markdownLines.push(`### ${line}`);
				continue;
			}

			// Heuristic 5: Technologies and Languages -> Bolded paragraph
			if (line.match(/^Technologies and Languages:/i)) {
				if (markdownLines[markdownLines.length - 1] !== "") {
					markdownLines.push("");
				}
				const content = line.replace(/^Technologies and Languages:\s*/i, "");
				markdownLines.push(`**Technologies and Languages:** ${content}`);
				continue;
			}

			// Heuristic 6: Awards Sub-categories (1st Place, 2nd Place, Finalist) -> H4
			if (line.match(/^(1st|2nd|3rd) Place:/i) || line.match(/^Finalist at/i)) {
				if (markdownLines[markdownLines.length - 1] !== "") {
					markdownLines.push("");
				}
				markdownLines.push(`#### ${line}`);
				continue;
			}

			// Heuristic 3: Lists
			if (
				line.startsWith("- ") ||
				line.startsWith("• ") ||
				line.startsWith("– ") ||
				line.startsWith("* ")
			) {
				const content = line.replace(/^[-•–*]\s*/, "");
				markdownLines.push(`- ${content}`);
				continue;
			}

			// Default: Text line
			markdownLines.push(line);
		}

		return markdownLines.join("\n");
	} finally {
		await parser.destroy();
	}
}

function isLikelySectionHeader(line: string): boolean {
	const clean = line.replace(/[^a-zA-Z]/g, "");
	if (clean.length < 3) return false;
	return clean === clean.toUpperCase();
}

function isLikelyJobTitle(line: string): boolean {
	// Must contain a separator
	if (!line.includes(" – ") && !line.includes(" - ")) return false;
	// Must contain a year
	if (!/\d{4}/.test(line)) return false;
	// Should not start with a bullet
	if (line.startsWith("-") || line.startsWith("•")) return false;
	return true;
}
