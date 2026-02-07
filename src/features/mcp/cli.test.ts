import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mcpCommand } from "./cli";

describe("MCP CLI Dispatcher", () => {
	let logSpy: any;
	let errorSpy: any;

	beforeEach(() => {
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	// We can now safely mock the loader without affecting other files
	// because other files don't import the loader.
	// However, we must ensure we mock it BEFORE mcpCommand imports it dynamically?
	// mcpCommand imports it dynamically. We can use mock.module to replace it.

	test("shows help with no args", async () => {
		const code = await mcpCommand([]);
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: nooa mcp"),
		);
	});

	test("shows help with --help", async () => {
		const code = await mcpCommand(["--help"]);
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: nooa mcp"),
		);
	});

	test("handles unknown subcommand", async () => {
		// We need to ensure loadCommand returns null for "unknown"
		// Since we are mocking the module for dispatches, we need to handle "unknown" too if we mock broadly.
		// But if we don't mock loader here, it will use real loader which returns null for unknown.
		const code = await mcpCommand(["unknown"]);
		expect(code).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Unknown subcommand: unknown"),
		);
	});

	test("dispatches subcommands", async () => {
		const spy = mock(async () => 42);

		// Mock the loader module
		mock.module("./loader", () => ({
			loadCommand: async (name: string) => {
				if (name === "test_cmd") return spy;
				return null;
			},
		}));

		const code = await mcpCommand(["test_cmd", "arg"]);
		expect(code).toBe(42);
		expect(spy).toHaveBeenCalledWith(["arg"]);
	});
});
