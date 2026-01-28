import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("CLI (index.ts)", () => {
	const binPath = join(process.cwd(), "index.ts");
	const _dummyRef = join(process.cwd(), "tests/dummy.pdf");

	it("should show simplified help on stderr when no arguments are provided", async () => {
		const { stderr } = await execa("bun", [binPath], { reject: false });
		expect(stderr).toContain("Run with --help");
	});

	it("should show help with --help", async () => {
		const { stdout } = await execa("bun", [binPath, "--help"]);
		expect(stdout).toContain("Usage:");
	});

	it("should handle missing files gracefully", async () => {
		const { stderr, exitCode } = await execa(
			"bun",
			[binPath, "non-existent.pdf"],
			{ reject: false },
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("not found");
	});

	// Note: Testing actual PDF conversion requires a real PDF,
	// but we can test the error handling of the argument parser.

	it("should fail if --to-pdf used without input markdown", async () => {
		const { stderr, exitCode } = await execa("bun", [binPath, "--to-pdf"], {
			reject: false,
		});
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("Input file is required");
	});
});
