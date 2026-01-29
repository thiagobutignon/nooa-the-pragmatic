import { beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../index";

// Mock dependencies
vi.mock("../src/converter", () => ({
	convertPdfToMarkdown: vi.fn().mockResolvedValue("# Mocked Markdown"),
}));

vi.mock("../src/pdf-generator", () => ({
	generatePdfFromMarkdown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("fs/promises", () => ({
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/json-resume", () => ({
	convertMarkdownToJsonResume: vi
		.fn()
		.mockReturnValue({ basics: { name: "JSON Resume" } }),
	convertJsonResumeToMarkdown: vi.fn().mockReturnValue("# Markdown from JSON"),
}));

vi.mock("../src/bridge", () => ({
	loadSpec: vi.fn().mockResolvedValue({
		info: { title: "Mock API" },
		paths: {
			"/test": { get: { operationId: "testOp", summary: "Test Summary" } },
		},
	}),
	executeBridgeRequest: vi.fn().mockResolvedValue({
		status: 200,
		statusText: "OK",
		data: { result: "success" },
	}),
}));

vi.mock("../src/validator", () => ({
	extractLinks: vi.fn().mockReturnValue([]),
	validateAllLinks: vi.fn().mockResolvedValue([]),
}));

// Mock Bun global
if (typeof (global as any).Bun === "undefined") {
	(global as any).Bun = {
		file: (path: string) => ({
			exists: async () => path !== "non-existent-at-all.pdf",
			text: async () =>
				path.endsWith(".json")
					? '{"basics": {"name": "Source JSON"}}'
					: "mock-content",
			arrayBuffer: async () => new ArrayBuffer(0),
		}),
		argv: ["bun", "index.ts"],
		main: "index.ts",
	};
}

describe("main function", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.exitCode = 0;
	});

	it("should show help with --help", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "--help"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
	});

	it("should show version with --version", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "--version"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("v1.1.0"));
	});

	it("should fail if no input is provided", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main(["bun", "index.ts"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Input file is required"),
		);
	});

	it("should fail if file does not exist", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main(["bun", "index.ts", "non-existent-at-all.pdf"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("File not found"),
		);
	});

	it("should successfully convert PDF to Markdown and print to stdout", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.pdf"]);
		expect(logSpy).toHaveBeenCalledWith("# Mocked Markdown");
		expect(process.exitCode).toBe(0);
	});

	it("should successfully convert PDF to Markdown and write to file", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.pdf", "-o", "out.md"]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully converted"),
		);
		expect(process.exitCode).toBe(0);
	});

	it("should successfully convert Markdown to PDF", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.md", "--to-pdf"]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully generated PDF"),
		);
		expect(process.exitCode).toBe(0);
	});

	it("should successfully output JSON structure", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.pdf", "--json"]);
		const outputJSON = logSpy.mock.calls[0]?.[0];
		expect(outputJSON).toBeDefined();
		expect(JSON.parse(outputJSON!)).toHaveProperty(
			"content",
			"# Mocked Markdown",
		);
	});

	it("should pass social link flags to the converter", async () => {
		const { convertPdfToMarkdown } = await import("../src/converter");
		const mockedConverter = vi.mocked(convertPdfToMarkdown);

		await main([
			"bun",
			"index.ts",
			"input.pdf",
			"--linkedin",
			"https://linkedin.com/in/user",
			"--github",
			"https://github.com/user",
			"--whatsapp",
			"987654321",
		]);

		expect(mockedConverter).toHaveBeenCalledWith(expect.any(Buffer), {
			linkedin: "https://linkedin.com/in/user",
			github: "https://github.com/user",
			whatsapp: "987654321",
		});
	});

	it("should handle errors during processing gracefully", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		const { convertPdfToMarkdown } = await import("../src/converter");
		vi.mocked(convertPdfToMarkdown).mockRejectedValueOnce(new Error("Boom!"));

		await main(["bun", "index.ts", "input.pdf"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith("Error:", "Boom!");
	});

	it("should convert Markdown/PDF to JSON Resume with --to-json-resume", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.pdf", "--to-json-resume"]);
		const output = logSpy.mock.calls[0]?.[0];
		expect(output).toContain('"name": "JSON Resume"');
	});

	it("should convert JSON Resume to Markdown with --from-json-resume", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "input.json", "--from-json-resume"]);
		expect(logSpy).toHaveBeenCalledWith("# Markdown from JSON");
	});

	it("should convert JSON Resume directly to PDF with --from-json-resume --to-pdf", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main([
			"bun",
			"index.ts",
			"input.json",
			"--from-json-resume",
			"--to-pdf",
		]);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully generated PDF from JSON Resume"),
		);
	});

	it("should support bridge mode --list", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		await main(["bun", "index.ts", "bridge", "https://api.com/spec.json", "--list"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Available operations in Mock API"));
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[GET] testOp (/test): Test Summary"));
	});

	it("should support bridge mode execute operation", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => { });
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main([
			"bun",
			"index.ts",
			"bridge",
			"https://api.com/spec.json",
			"--op",
			"testOp",
		]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"result": "success"'));
	});

	it("should handle bridge mode failure gracefully", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		const { executeBridgeRequest } = await import("../src/bridge");
		vi.mocked(executeBridgeRequest).mockRejectedValueOnce(new Error("Bridge Failed"));

		await main(["bun", "index.ts", "bridge", "spec.json", "--op", "testOp"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith("Bridge Error:", "Bridge Failed");
	});

	it("should fail bridge mode if spec is missing", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		await main(["bun", "index.ts", "bridge"]);
		expect(process.exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("OpenAPI spec URL or path is required"));
	});

	it("should handle link validation with no links found", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
		const { extractLinks } = await import("../src/validator");
		vi.mocked(extractLinks).mockReturnValueOnce([]);

		await main(["bun", "index.ts", "input.pdf", "--validate"]);
		expect(errorSpy).toHaveBeenCalledWith("No links found to validate.");
	});
});
