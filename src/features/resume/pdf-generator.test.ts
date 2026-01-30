import {
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";

const mocks = {
	mockPage: {
		setContent: () => {},
		pdf: () => {},
		close: () => {},
	},
	mockBrowser: {
		newPage: async () => mocks.mockPage,
		close: () => {},
	},
};

const setContentSpy = spyOn(mocks.mockPage, "setContent");
const pdfSpy = spyOn(mocks.mockPage, "pdf");
const pageCloseSpy = spyOn(mocks.mockPage, "close");
const newPageSpy = spyOn(mocks.mockBrowser, "newPage");
const browserCloseSpy = spyOn(mocks.mockBrowser, "close");

const puppeteerMocks = {
	launch: async () => mocks.mockBrowser,
};

const launchSpy = spyOn(puppeteerMocks, "launch");

mock.module("puppeteer", () => ({
	default: puppeteerMocks,
}));

let generatePdfFromMarkdown: typeof import("./pdf-generator").generatePdfFromMarkdown;

beforeAll(async () => {
	({ generatePdfFromMarkdown } = await import("./pdf-generator"));
});

describe("generatePdfFromMarkdown", () => {
	beforeEach(() => {
		setContentSpy.mockReset();
		pdfSpy.mockReset();
		pageCloseSpy.mockReset();
		newPageSpy.mockReset();
		browserCloseSpy.mockReset();
		launchSpy.mockReset();
		newPageSpy.mockResolvedValue(mocks.mockPage);
		launchSpy.mockResolvedValue(mocks.mockBrowser);
		mock.clearAllMocks();
	});

	it("should generate PDF from markdown", async () => {
		const markdown = "# Hello World";
		const outputPath = "output.pdf";

		await generatePdfFromMarkdown(markdown, outputPath);

		expect(newPageSpy).toHaveBeenCalled();
		expect(setContentSpy).toHaveBeenCalled();
		expect(pdfSpy).toHaveBeenCalledWith({
			path: outputPath,
			format: "A4",
			printBackground: true,
			margin: expect.any(Object),
		});
		expect(browserCloseSpy).toHaveBeenCalled();
	});

	it("should handle setContent arguments containing converted HTML", async () => {
		const markdown = "# Test Header";
		await generatePdfFromMarkdown(markdown, "test.pdf");

		const setContentCall = setContentSpy.mock.calls[0];
		expect(setContentCall).toBeDefined();
		const htmlContent = setContentCall?.[0];
		expect(htmlContent).toContain("<h1>Test Header</h1>");
		expect(htmlContent).toContain("<style>");
	});
});
