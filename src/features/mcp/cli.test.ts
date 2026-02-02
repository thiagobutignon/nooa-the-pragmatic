import { beforeEach, expect, test } from "bun:test";
import { mcpCommand } from "./cli";

test("MCP CLI shows help", async () => {
    const exitCode = await mcpCommand(["--help"]);
    expect(exitCode).toBe(0);
});

test("MCP CLI requires subcommand", async () => {
    const exitCode = await mcpCommand([]);
    expect(exitCode).toBe(0); // Shows help
});

test("MCP CLI rejects unknown subcommand", async () => {
    const exitCode = await mcpCommand(["unknown-command"]);
    expect(exitCode).toBe(1);
});
