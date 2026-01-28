import { marked } from "marked";
import puppeteer from "puppeteer";

const RESUME_STYLES = `
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    line-height: 1.3;
    color: #111;
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
    font-size: 11px;
  }
  h1 {
    font-size: 20px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0;
    color: #000;
    letter-spacing: 0.5px;
    border-bottom: none;
  }
  /* Heuristic: The paragraph immediately following H1 is usually contact info */
  h1 + p {
    text-align: center;
    font-size: 11px;
    margin-bottom: 1rem;
    color: #333;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
  }
  h2 {
    font-size: 14px;
    margin-top: 1.2rem;
    margin-bottom: 0.5rem;
    color: #000;
    font-weight: 800;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
  }
  h3 {
    font-size: 12px;
    margin-top: 0.8rem;
    color: #222;
    font-weight: 700;
  }
  h4 {
    font-size: 11px;
    margin-top: 0.5rem;
    margin-bottom: 0.2rem;
    color: #333;
    font-weight: 700;
    font-style: italic;
  }
  p {
    margin-bottom: 0.4rem;
    text-align: justify;
    font-size: 11px;
  }
  ul {
    padding-left: 1.2rem;
    margin-bottom: 0.5rem;
  }
  li {
    margin-bottom: 0.1rem;
  }
  a {
    color: #0066cc;
    text-decoration: none;
  }
  @page {
    margin: 0.75cm;
  }
`;

export async function generatePdfFromMarkdown(
	markdown: string,
	outputPath: string,
): Promise<void> {
	// Convert Markdown to HTML
	const htmlContent = await marked.parse(markdown);

	const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume</title>
  <style>
    ${RESUME_STYLES}
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
`;

	// Launch browser and print to PDF
	// @ts-expect-error
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	try {
		const page = await browser.newPage();

		// Set content and wait for network idle to ensure font loading etc
		await page.setContent(fullHtml, { waitUntil: "networkidle0" });

		await page.pdf({
			path: outputPath,
			format: "A4",
			printBackground: true,
			margin: {
				top: "1cm",
				right: "1cm",
				bottom: "1cm",
				left: "1cm",
			},
		});
	} finally {
		await browser.close();
	}
}
