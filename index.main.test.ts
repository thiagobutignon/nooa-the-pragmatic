import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";

let main: typeof import("./index").main;

let converterSpy: ReturnType<typeof spyOn>;
let pdfGeneratorSpy: ReturnType<typeof spyOn>;
let writeFileSpy: ReturnType<typeof spyOn>;
let convertMarkdownToJsonResumeSpy: ReturnType<typeof spyOn>;
let convertJsonResumeToMarkdownSpy: ReturnType<typeof spyOn>;
let loadSpecSpy: ReturnType<typeof spyOn>;
let executeBridgeRequestSpy: ReturnType<typeof spyOn>;
let extractLinksSpy: ReturnType<typeof spyOn>;
let validateAllLinksSpy: ReturnType<typeof spyOn>;

beforeAll(async () => {
	const converter = await import("./src/features/resume/converter");
	const pdfGenerator = await import("./src/features/resume/pdf-generator");
	const fsPromises = await import("node:fs/promises");
	const jsonResume = await import("./src/features/resume/json-resume");
	const bridge = await import("./src/features/bridge/bridge");
	const validator = await import("./src/features/resume/validator");

	converterSpy = spyOn(converter, "convertPdfToMarkdown");
	pdfGeneratorSpy = spyOn(pdfGenerator, "generatePdfFromMarkdown");
	writeFileSpy = spyOn(fsPromises, "writeFile");
	convertMarkdownToJsonResumeSpy = spyOn(
		jsonResume,
		"convertMarkdownToJsonResume",
	);
	convertJsonResumeToMarkdownSpy = spyOn(
		jsonResume,
		"convertJsonResumeToMarkdown",
	);
	loadSpecSpy = spyOn(bridge, "loadSpec");
	executeBridgeRequestSpy = spyOn(bridge, "executeBridgeRequest");
	extractLinksSpy = spyOn(validator, "extractLinks");
	validateAllLinksSpy = spyOn(validator, "validateAllLinks");

	({ main } = await import("./index"));
});

afterAll(() => {
	converterSpy.mockRestore();
	pdfGeneratorSpy.mockRestore();
	writeFileSpy.mockRestore();
	convertMarkdownToJsonResumeSpy.mockRestore();
	convertJsonResumeToMarkdownSpy.mockRestore();
	loadSpecSpy.mockRestore();
	executeBridgeRequestSpy.mockRestore();
	extractLinksSpy.mockRestore();
	validateAllLinksSpy.mockRestore();
});

describe("main function", () => {
	let bunFileSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mock.clearAllMocks();
		process.exitCode = 0;

		converterSpy.mockReset();
		converterSpy.mockResolvedValue("# Mocked Markdown");
		pdfGeneratorSpy.mockReset();
		pdfGeneratorSpy.mockResolvedValue(undefined);
		writeFileSpy.mockReset();
		writeFileSpy.mockResolvedValue(undefined);
		convertMarkdownToJsonResumeSpy.mockReset();
		convertMarkdownToJsonResumeSpy.mockReturnValue({
			basics: { name: "JSON Resume" },
		});
		convertJsonResumeToMarkdownSpy.mockReset();
		convertJsonResumeToMarkdownSpy.mockReturnValue("# Markdown from JSON");
		loadSpecSpy.mockReset();
		loadSpecSpy.mockResolvedValue({
			info: { title: "Mock API" },
			paths: {
				"/test": { get: { operationId: "testOp", summary: "Test Summary" } },
			},
		});
		executeBridgeRequestSpy.mockReset();
		executeBridgeRequestSpy.mockResolvedValue({
			status: 200,
			statusText: "OK",
			data: { result: "success" },
		});
		extractLinksSpy.mockReset();
		extractLinksSpy.mockReturnValue([]);
		validateAllLinksSpy.mockReset();
		validateAllLinksSpy.mockResolvedValue([]);

		bunFileSpy = spyOn(Bun, "file");
		bunFileSpy.mockImplementation((path: string) => ({
			exists: async () => path !== "non-existent-at-all.pdf",
			text: async () =>
				path.endsWith(".json")
					? '{"basics": {"name": "Source JSON"}}'
					: "mock-content",
			arrayBuffer: async () => new ArrayBuffer(0),
		}));
	});

	afterEach(() => {
		bunFileSpy.mockRestore();
	});

	it("should show help with --help", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["--help"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
	});

	it("should show version with --version", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["--version"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("nooa v0.0.1"));
	});

	it("should fail if no input is provided", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["resume"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Input file is required"),
		);
	});

	it("should fail if file does not exist", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["resume", "non-existent-at-all.pdf"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("File not found"),
		);
	});

	it("should successfully convert PDF to Markdown and print to stdout", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["resume", "input.pdf"]);
		expect(logSpy).toHaveBeenCalledWith("# Mocked Markdown");
		expect(process.exitCode).toBe(0);
	});

	it("should successfully convert PDF to Markdown and write to file", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["resume", "input.pdf", "-o", "out.md"]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully converted"),
		);
		expect(process.exitCode).toBe(0);
	});

	it("should successfully convert Markdown to PDF", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["resume", "input.md", "--to-pdf"]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully generated PDF"),
		);
		expect(process.exitCode).toBe(0);
	});

	it("should successfully output JSON structure", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["resume", "input.pdf", "--json"]);
		const outputJSON = logSpy.mock.calls[0]?.[0];
		expect(outputJSON).toBeDefined();
		if (typeof outputJSON !== "string") {
			throw new Error("Expected JSON output string");
		}
		expect(JSON.parse(outputJSON)).toHaveProperty(
			"content",
			"# Mocked Markdown",
		);
	});

	it("should pass social link flags to the converter", async () => {
		await main([
			"resume",
			"input.pdf",
			"--linkedin",
			"https://linkedin.com/in/user",
			"--github",
			"https://github.com/user",
			"--whatsapp",
			"987654321",
		]);

		expect(converterSpy).toHaveBeenCalledWith(expect.any(Buffer), {
			linkedin: "https://linkedin.com/in/user",
			github: "https://github.com/user",
			whatsapp: "987654321",
		});
	});

	it("should handle errors during processing gracefully", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		converterSpy.mockRejectedValueOnce(new Error("Boom!"));

		await main(["resume", "input.pdf"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith("Error:", "Boom!");
	});

	it("should convert Markdown/PDF to JSON Resume with --to-json-resume", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["resume", "input.pdf", "--to-json-resume"]);
		const output = logSpy.mock.calls[0]?.[0];
		expect(output).toContain('"name": "JSON Resume"');
	});

	it("should convert JSON Resume to Markdown with --from-json-resume", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["resume", "input.json", "--from-json-resume"]);
		expect(logSpy).toHaveBeenCalledWith("# Markdown from JSON");
	});

	it("should convert JSON Resume directly to PDF with --from-json-resume --to-pdf", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["resume", "input.json", "--from-json-resume", "--to-pdf"]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully generated PDF from JSON Resume"),
		);
	});

	it("should support bridge mode --list", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["bridge", "https://api.com/spec.json", "--list"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Available operations in Mock API"),
		);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("[GET] testOp (/test): Test Summary"),
		);
	});

	it("should support bridge mode execute operation", async () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		await main(["bridge", "https://api.com/spec.json", "--op", "testOp"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining('"result": "success"'),
		);
	});

	it("should handle bridge mode failure gracefully", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		executeBridgeRequestSpy.mockRejectedValueOnce(new Error("Bridge Failed"));

		await main(["bridge", "spec.json", "--op", "testOp"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith("Bridge Error:", "Bridge Failed");
	});

	it("should fail bridge mode if spec is missing", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		await main(["bridge"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("OpenAPI spec URL or path is required"),
		);
	});

	it("should handle link validation with no links found", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		extractLinksSpy.mockReturnValueOnce([]);

		await main(["resume", "input.pdf", "--validate"]);
		expect(errorSpy).toHaveBeenCalledWith("No links found to validate.");
	});
});
