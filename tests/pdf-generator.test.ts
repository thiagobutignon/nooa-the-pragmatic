import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePdfFromMarkdown } from "../src/pdf-generator";

// Hoist mocks to avoid reference errors during vi.mock execution
const mocks = vi.hoisted(() => ({
	mockPage: {
		setContent: vi.fn(),
		pdf: vi.fn(),
		close: vi.fn(),
	},
	mockBrowser: {
		newPage: vi.fn(),
		close: vi.fn(),
	},
}));

mocks.mockBrowser.newPage.mockResolvedValue(mocks.mockPage);

// Mock puppeteer
vi.mock("puppeteer", () => ({
	default: {
		launch: vi.fn().mockResolvedValue(mocks.mockBrowser),
	},
}));

// Mock 'marked' isn't arguably strictly necessary if we just check the HTML passed to setContent matches expectation,
// but let's assume marked works. We can check if setContent receives converted HTML.

describe("generatePdfFromMarkdown", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should generate PDF from markdown", async () => {
		const markdown = "# Hello World";
		const outputPath = "output.pdf";

		await generatePdfFromMarkdown(markdown, outputPath);

		expect(mocks.mockBrowser.newPage).toHaveBeenCalled();
		expect(mocks.mockPage.setContent).toHaveBeenCalled();
		expect(mocks.mockPage.pdf).toHaveBeenCalledWith({
			path: outputPath,
			format: "A4",
			printBackground: true,
			margin: expect.any(Object),
		});
		expect(mocks.mockBrowser.close).toHaveBeenCalled();
	});

	it("should handle setContent arguments containing converted HTML", async () => {
		const markdown = "# Test Header";
		await generatePdfFromMarkdown(markdown, "test.pdf");

		const setContentCall = mocks.mockPage.setContent.mock.calls[0];
		expect(setContentCall).toBeDefined();
		const htmlContent = setContentCall?.[0];
		expect(htmlContent).toContain("<h1>Test Header</h1>");
		expect(htmlContent).toContain("<style>"); // Should include CSS
	});
});
