import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const converterMocks = {
	convertPdfToMarkdown: async () => "# Resume\n\n[Valid](https://ok.com) and [Broken](https://error.com)",
};
mock.module("../src/converter", () => converterMocks);

const pdfGeneratorMocks = {
	generatePdfFromMarkdown: async () => undefined,
};
mock.module("../src/pdf-generator", () => pdfGeneratorMocks);

let main: typeof import("../index").main;

beforeAll(async () => {
	({ main } = await import("../index"));
});

describe("CLI --validate integration", () => {
	let fetchSpy: ReturnType<typeof spyOn>;
	let bunFileSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
		bunFileSpy = spyOn(Bun, "file");
		bunFileSpy.mockImplementation((_path: string) => ({
			exists: async () => true,
			text: async () =>
				"# Resume\n\n[Valid](https://ok.com) and [Broken](https://error.com)",
			arrayBuffer: async () => new ArrayBuffer(0),
		}));
		process.exitCode = 0;
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		bunFileSpy.mockRestore();
		mock.clearAllMocks();
	});

	it("should pass and return exit code 0 when all links are valid", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

		await main(["resume", "resume.md", "--validate"]);

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("All links are valid!"),
		);
		expect(process.exitCode).toBe(0);
	});

	it("should fail and return exit code 1 when a link is broken", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});

		fetchSpy
			.mockResolvedValueOnce({ ok: true, status: 200 } as Response)
			.mockResolvedValueOnce({ ok: false, status: 404 } as Response);

		await main(["resume", "resume.md", "--validate"]);

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Validation failed: 1 link(s) are unreachable."),
		);
		expect(process.exitCode).toBe(1);
	});

	it("should report specific error for timeouts", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});

		fetchSpy.mockRejectedValue({ name: "AbortError" });

		await main(["resume", "resume.md", "--validate"]);

		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Timeout"));
		expect(process.exitCode).toBe(1);
	});
});
