import { describe, expect, test, spyOn, mock, afterEach } from "bun:test";
import { mcpCommand } from "./cli";

describe("MCP CLI Dispatcher", () => {
	const logSpy = spyOn(console, "log").mockImplementation(() => { });
	const errorSpy = spyOn(console, "error").mockImplementation(() => { });

	afterEach(() => {
		logSpy.mockClear();
		errorSpy.mockClear();
	});

	// Helper to mock submodule import
	const mockAction = mock(async () => 0);

	test("shows help with no args", async () => {
		const code = await mcpCommand([]);
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: nooa mcp"));
	});

	test("shows help with --help", async () => {
		const code = await mcpCommand(["--help"]);
		expect(code).toBe(0);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: nooa mcp"));
	});

	test("handles unknown subcommand", async () => {
		const code = await mcpCommand(["unknown"]);
		expect(code).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown subcommand: unknown"));
	});

	const subcommands = [
		["init", "./init", "initCommand"],
		["alias", "./alias", "aliasCommand"],
		["list", "./list", "listCommand"],
		["install", "./install", "installCommand"],
		["enable", "./enable", "enableCommand"],
		["disable", "./disable", "disableCommand"],
		["call", "./call", "callCommand"],
		["resource", "./resource", "resourceCommand"],
		["health", "./health", "healthCommand"],
		["marketplace", "./marketplace", "marketplaceCommand"],
		["info", "./info", "infoCommand"],
		["configure", "./configure", "configureCommand"],
		["uninstall", "./uninstall", "uninstallCommand"],
		["test", "./test", "testCommand"],
	];

	for (const [cmd, module, exportName] of subcommands) {
		test(`dispatches ${cmd}`, async () => {
			const spy = mock(async () => 42); // Distinct return code

			mock.module(module, () => ({
				[exportName]: spy
			}));

			// Re-import to ensure mocks are applied? 
			// In Bun, mock.module applies to subsequent imports.
			// But mcpCommand uses dynamic import(), so it should pick it up.

			const code = await mcpCommand([cmd, "arg"]);
			expect(code).toBe(42);
			expect(spy).toHaveBeenCalled();
		});
	}
});
